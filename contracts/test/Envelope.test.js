import { expect } from "chai";
import { network } from "hardhat";

describe("Envelope", function () {
  let ethers;
  let envelope;
  let token;
  let otherToken;
  let portfolio;
  let otherAccount;

  beforeEach(async function () {
    ({ ethers } = await network.connect());
    [portfolio, otherAccount] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token = await MockERC20.deploy("Mock USDC", "USDC", 6);
    otherToken = await MockERC20.deploy("Other Token", "OTH", 18);

    const Envelope = await ethers.getContractFactory("Envelope");
    envelope = await Envelope.deploy(
      portfolio.address,
      await token.getAddress(),
      ethers.encodeBytes32String("groceries")
    );
  });

  describe("constructor", function () {
    it("reverts when portfolio address is zero", async function () {
      const Envelope = await ethers.getContractFactory("Envelope");
      await expect(
        Envelope.deploy(
          ethers.ZeroAddress,
          await token.getAddress(),
          ethers.encodeBytes32String("test")
        )
      ).to.be.revertedWithCustomError({ interface: (await ethers.getContractFactory("Envelope")).interface }, "ZeroAddress");
    });

    it("reverts when token address is zero", async function () {
      const Envelope = await ethers.getContractFactory("Envelope");
      await expect(
        Envelope.deploy(
          portfolio.address,
          ethers.ZeroAddress,
          ethers.encodeBytes32String("test")
        )
      ).to.be.revertedWithCustomError({ interface: (await ethers.getContractFactory("Envelope")).interface }, "ZeroAddress");
    });
  });

  describe("state", function () {
    it("stores the portfolio address", async function () {
      expect(await envelope.portfolio()).to.equal(portfolio.address);
    });

    it("stores the token address", async function () {
      expect(await envelope.token()).to.equal(await token.getAddress());
    });

    it("stores the name", async function () {
      expect(await envelope.name()).to.equal(
        ethers.encodeBytes32String("groceries")
      );
    });
  });

  describe("balance()", function () {
    it("returns 0 when empty", async function () {
      expect(await envelope.balance()).to.equal(0n);
    });

    it("returns the token balance after a direct deposit", async function () {
      await token.mint(await envelope.getAddress(), 1000n);
      expect(await envelope.balance()).to.equal(1000n);
    });
  });

  describe("ETH rejection", function () {
    it("reverts when ETH is sent directly", async function () {
      await expect(
        portfolio.sendTransaction({
          to: await envelope.getAddress(),
          value: ethers.parseEther("1"),
        })
      ).to.be.revertedWithCustomError(envelope, "ETHNotAccepted");
    });
  });

  describe("sendFunds()", function () {
    beforeEach(async function () {
      await token.mint(await envelope.getAddress(), 1000n);
    });

    it("allows the portfolio to transfer funds out", async function () {
      await envelope.connect(portfolio).sendFunds(otherAccount.address, 500n);
      expect(await token.balanceOf(otherAccount.address)).to.equal(500n);
    });

    it("reduces the envelope balance after transfer", async function () {
      await envelope.connect(portfolio).sendFunds(otherAccount.address, 300n);
      expect(await envelope.balance()).to.equal(700n);
    });

    it("reverts when called by a non-portfolio address", async function () {
      await expect(
        envelope.connect(otherAccount).sendFunds(otherAccount.address, 500n)
      ).to.be.revertedWithCustomError(envelope, "OnlyPortfolio");
    });

  });

  describe("rescueToken()", function () {
    beforeEach(async function () {
      await otherToken.mint(await envelope.getAddress(), 500n);
    });

    it("allows the portfolio to rescue an accidentally sent ERC-20", async function () {
      await envelope.connect(portfolio).rescueToken(
        await otherToken.getAddress(),
        otherAccount.address,
        500n
      );
      expect(await otherToken.balanceOf(otherAccount.address)).to.equal(500n);
    });

    it("reverts when trying to rescue the primary token", async function () {
      await token.mint(await envelope.getAddress(), 100n);
      await expect(
        envelope.connect(portfolio).rescueToken(
          await token.getAddress(),
          otherAccount.address,
          100n
        )
      ).to.be.revertedWithCustomError(envelope, "CannotRescuePrimaryToken");
    });

    it("reverts when called by a non-portfolio address", async function () {
      await expect(
        envelope.connect(otherAccount).rescueToken(
          await otherToken.getAddress(),
          otherAccount.address,
          500n
        )
      ).to.be.revertedWithCustomError(envelope, "OnlyPortfolio");
    });
  });

  describe("sendFunds() — additional", function () {
    it("only the portfolio can move funds — any other caller is rejected", async function () {
      // Deploy a second envelope to use as a caller (simulates a rogue contract)
      const Envelope = await ethers.getContractFactory("Envelope");
      const rogueEnvelope = await Envelope.deploy(
        otherAccount.address,
        await token.getAddress(),
        ethers.encodeBytes32String("rogue")
      );

      // otherAccount is not the portfolio of `envelope`, so this must revert
      await expect(
        envelope.connect(otherAccount).sendFunds(await rogueEnvelope.getAddress(), 500n)
      ).to.be.revertedWithCustomError(envelope, "OnlyPortfolio");
    });
  });
});
