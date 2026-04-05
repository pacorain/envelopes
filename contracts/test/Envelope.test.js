import { expect } from "chai";
import { ethers } from "hardhat";

describe("Envelope", function () {
  let envelope;
  let token;
  let portfolio;
  let otherAccount;

  beforeEach(async function () {
    [portfolio, otherAccount] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token = await MockERC20.deploy("Mock USDC", "USDC", 6);

    const Envelope = await ethers.getContractFactory("Envelope");
    envelope = await Envelope.deploy(
      portfolio.address,
      await token.getAddress(),
      ethers.encodeBytes32String("groceries")
    );
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

  describe("transfer()", function () {
    beforeEach(async function () {
      await token.mint(await envelope.getAddress(), 1000n);
    });

    it("allows the portfolio to transfer funds out", async function () {
      await envelope.connect(portfolio).transfer(otherAccount.address, 500n);
      expect(await token.balanceOf(otherAccount.address)).to.equal(500n);
    });

    it("reduces the envelope balance after transfer", async function () {
      await envelope.connect(portfolio).transfer(otherAccount.address, 300n);
      expect(await envelope.balance()).to.equal(700n);
    });

    it("reverts when called by a non-portfolio address", async function () {
      await expect(
        envelope.connect(otherAccount).transfer(otherAccount.address, 500n)
      ).to.be.revertedWithCustomError(envelope, "OnlyPortfolio");
    });

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
        envelope.connect(otherAccount).transfer(await rogueEnvelope.getAddress(), 500n)
      ).to.be.revertedWithCustomError(envelope, "OnlyPortfolio");
    });
  });
});
