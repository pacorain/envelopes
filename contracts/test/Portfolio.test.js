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

  describe("proposeAdmin()", function () {
    it("sets pendingAdmin", async function () {
      await portfolio.connect(admin).proposeAdmin(otherAccount.address);
      expect(await portfolio.pendingAdmin()).to.equal(otherAccount.address);
    });

    it("does not change admin immediately", async function () {
      await portfolio.connect(admin).proposeAdmin(otherAccount.address);
      expect(await portfolio.admin()).to.equal(admin.address);
    });

    it("emits AdminTransferProposed", async function () {
      await expect(portfolio.connect(admin).proposeAdmin(otherAccount.address))
        .to.emit(portfolio, "AdminTransferProposed")
        .withArgs(admin.address, otherAccount.address);
    });

    it("reverts when called by non-admin", async function () {
      await expect(
        portfolio.connect(otherAccount).proposeAdmin(otherAccount.address)
      ).to.be.revertedWithCustomError(portfolio, "OnlyAdmin");
    });

    it("reverts when proposed address is zero", async function () {
      await expect(
        portfolio.connect(admin).proposeAdmin(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(portfolio, "ZeroAddress");
    });
  });

  describe("acceptAdmin()", function () {
    beforeEach(async function () {
      await portfolio.connect(admin).proposeAdmin(otherAccount.address);
    });

    it("sets admin to pendingAdmin", async function () {
      await portfolio.connect(otherAccount).acceptAdmin();
      expect(await portfolio.admin()).to.equal(otherAccount.address);
    });

    it("clears pendingAdmin after acceptance", async function () {
      await portfolio.connect(otherAccount).acceptAdmin();
      expect(await portfolio.pendingAdmin()).to.equal(ethers.ZeroAddress);
    });

    it("emits AdminTransferred on acceptance", async function () {
      await expect(portfolio.connect(otherAccount).acceptAdmin())
        .to.emit(portfolio, "AdminTransferred")
        .withArgs(admin.address, otherAccount.address);
    });

    it("reverts when called by non-pendingAdmin", async function () {
      const [, , thirdAccount] = await ethers.getSigners();
      await expect(
        portfolio.connect(thirdAccount).acceptAdmin()
      ).to.be.revertedWithCustomError(portfolio, "OnlyPendingAdmin");
    });

    it("reverts when called by current admin (not pendingAdmin)", async function () {
      await expect(
        portfolio.connect(admin).acceptAdmin()
      ).to.be.revertedWithCustomError(portfolio, "OnlyPendingAdmin");
    });

    it("new admin can perform admin actions after acceptance", async function () {
      await portfolio.connect(otherAccount).acceptAdmin();
      const [, , newWithdrawal] = await ethers.getSigners();
      await portfolio.connect(otherAccount).setWithdrawalAddress(newWithdrawal.address);
      expect(await portfolio.withdrawalAddress()).to.equal(newWithdrawal.address);
    });

    it("old admin can no longer perform admin actions after acceptance", async function () {
      await portfolio.connect(otherAccount).acceptAdmin();
      const [, , newWithdrawal] = await ethers.getSigners();
      await expect(
        portfolio.connect(admin).setWithdrawalAddress(newWithdrawal.address)
      ).to.be.revertedWithCustomError(portfolio, "OnlyAdmin");
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
