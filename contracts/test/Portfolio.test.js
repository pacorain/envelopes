import { expect } from "chai";
import { ethers } from "hardhat";

describe("Portfolio", function () {
  let portfolio;
  let token;
  let admin;
  let otherAccount;
  let withdrawalAddress;

  beforeEach(async function () {
    [admin, otherAccount] = await ethers.getSigners();
    withdrawalAddress = otherAccount.address;

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token = await MockERC20.deploy("Mock USDC", "USDC", 6);

    const Portfolio = await ethers.getContractFactory("Portfolio");
    portfolio = await Portfolio.deploy(
      await token.getAddress(),
      withdrawalAddress
    );
  });

  describe("constructor", function () {
    it("stores the token address", async function () {
      expect(await portfolio.token()).to.equal(await token.getAddress());
    });

    it("sets admin to the deployer", async function () {
      expect(await portfolio.admin()).to.equal(admin.address);
    });

    it("stores the withdrawal address", async function () {
      expect(await portfolio.withdrawalAddress()).to.equal(withdrawalAddress);
    });

    it("emits WithdrawalAddressSet on deploy", async function () {
      const Portfolio = await ethers.getContractFactory("Portfolio");
      const tx = Portfolio.deploy(await token.getAddress(), withdrawalAddress);
      await expect(tx)
        .to.emit(await tx, "WithdrawalAddressSet")
        .withArgs(withdrawalAddress);
    });

    it("reverts when token address is zero", async function () {
      const Portfolio = await ethers.getContractFactory("Portfolio");
      await expect(
        Portfolio.deploy(ethers.ZeroAddress, withdrawalAddress)
      ).to.be.revertedWithCustomError(
        { interface: (await ethers.getContractFactory("Portfolio")).interface },
        "ZeroAddress"
      );
    });

    it("reverts when token address is an EOA (not a contract)", async function () {
      const Portfolio = await ethers.getContractFactory("Portfolio");
      await expect(
        Portfolio.deploy(otherAccount.address, withdrawalAddress)
      ).to.be.revertedWithCustomError(
        { interface: (await ethers.getContractFactory("Portfolio")).interface },
        "InvalidToken"
      );
    });

    it("reverts when withdrawal address is zero", async function () {
      const Portfolio = await ethers.getContractFactory("Portfolio");
      await expect(
        Portfolio.deploy(await token.getAddress(), ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(
        { interface: (await ethers.getContractFactory("Portfolio")).interface },
        "ZeroAddress"
      );
    });
  });

  describe("setWithdrawalAddress()", function () {
    it("allows admin to update the withdrawal address", async function () {
      const [, , newWithdrawal] = await ethers.getSigners();
      await portfolio.connect(admin).setWithdrawalAddress(newWithdrawal.address);
      expect(await portfolio.withdrawalAddress()).to.equal(newWithdrawal.address);
    });

    it("emits WithdrawalAddressSet on update", async function () {
      const [, , newWithdrawal] = await ethers.getSigners();
      await expect(
        portfolio.connect(admin).setWithdrawalAddress(newWithdrawal.address)
      )
        .to.emit(portfolio, "WithdrawalAddressSet")
        .withArgs(newWithdrawal.address);
    });

    it("reverts when called by non-admin", async function () {
      await expect(
        portfolio.connect(otherAccount).setWithdrawalAddress(otherAccount.address)
      ).to.be.revertedWithCustomError(portfolio, "OnlyAdmin");
    });

    it("reverts when new address is zero", async function () {
      await expect(
        portfolio.connect(admin).setWithdrawalAddress(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(portfolio, "ZeroAddress");
    });
  });
});
