import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

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

    it("emits AdminTransferred on deploy", async function () {
      const Portfolio = await ethers.getContractFactory("Portfolio");
      const tx = Portfolio.deploy(await token.getAddress(), withdrawalAddress);
      await expect(tx)
        .to.emit(await tx, "AdminTransferred")
        .withArgs(ethers.ZeroAddress, admin.address);
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

  describe("cancelPendingAdmin()", function () {
    beforeEach(async function () {
      await portfolio.connect(admin).proposeAdmin(otherAccount.address);
    });

    it("clears pendingAdmin", async function () {
      await portfolio.connect(admin).cancelPendingAdmin();
      expect(await portfolio.pendingAdmin()).to.equal(ethers.ZeroAddress);
    });

    it("does not change admin", async function () {
      await portfolio.connect(admin).cancelPendingAdmin();
      expect(await portfolio.admin()).to.equal(admin.address);
    });

    it("emits AdminTransferCancelled", async function () {
      await expect(portfolio.connect(admin).cancelPendingAdmin())
        .to.emit(portfolio, "AdminTransferCancelled")
        .withArgs(admin.address, otherAccount.address);
    });

    it("reverts when called by non-admin", async function () {
      await expect(
        portfolio.connect(otherAccount).cancelPendingAdmin()
      ).to.be.revertedWithCustomError(portfolio, "OnlyAdmin");
    });

    it("acceptAdmin() reverts after cancelPendingAdmin() is called", async function () {
      await portfolio.connect(admin).cancelPendingAdmin();
      await expect(
        portfolio.connect(otherAccount).acceptAdmin()
      ).to.be.revertedWithCustomError(portfolio, "OnlyPendingAdmin");
    });
  });

  describe("addManager()", function () {
    it("grants the manager role", async function () {
      await portfolio.connect(admin).addManager(otherAccount.address);
      expect(await portfolio.managers(otherAccount.address)).to.be.true;
    });

    it("emits ManagerAdded", async function () {
      await expect(portfolio.connect(admin).addManager(otherAccount.address))
        .to.emit(portfolio, "ManagerAdded")
        .withArgs(otherAccount.address);
    });

    it("reverts when called by non-admin", async function () {
      await expect(
        portfolio.connect(otherAccount).addManager(otherAccount.address)
      ).to.be.revertedWithCustomError(portfolio, "OnlyAdmin");
    });

    it("reverts when address is zero", async function () {
      await expect(
        portfolio.connect(admin).addManager(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(portfolio, "ZeroAddress");
    });

    it("does not emit ManagerAdded if address is already a manager", async function () {
      await portfolio.connect(admin).addManager(otherAccount.address);
      await expect(portfolio.connect(admin).addManager(otherAccount.address))
        .to.not.emit(portfolio, "ManagerAdded");
    });
  });

  describe("removeManager()", function () {
    beforeEach(async function () {
      await portfolio.connect(admin).addManager(otherAccount.address);
    });

    it("revokes the manager role", async function () {
      await portfolio.connect(admin).removeManager(otherAccount.address);
      expect(await portfolio.managers(otherAccount.address)).to.be.false;
    });

    it("emits ManagerRemoved", async function () {
      await expect(portfolio.connect(admin).removeManager(otherAccount.address))
        .to.emit(portfolio, "ManagerRemoved")
        .withArgs(otherAccount.address);
    });

    it("reverts when called by non-admin", async function () {
      await expect(
        portfolio.connect(otherAccount).removeManager(otherAccount.address)
      ).to.be.revertedWithCustomError(portfolio, "OnlyAdmin");
    });

    it("does not emit ManagerRemoved if address was not a manager", async function () {
      const [, , thirdAccount] = await ethers.getSigners();
      await expect(portfolio.connect(admin).removeManager(thirdAccount.address))
        .to.not.emit(portfolio, "ManagerRemoved");
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

  describe("deposit()", function () {
    const DEPOSIT_AMOUNT = 1000n * 10n ** 6n; // 1000 USDC (6 decimals)

    beforeEach(async function () {
      await token.mint(admin.address, DEPOSIT_AMOUNT);
      await token.connect(admin).approve(await portfolio.getAddress(), DEPOSIT_AMOUNT);
    });

    it("transfers tokens into the portfolio", async function () {
      await portfolio.connect(admin).deposit(DEPOSIT_AMOUNT);
      expect(await token.balanceOf(await portfolio.getAddress())).to.equal(DEPOSIT_AMOUNT);
    });

    it("increases unallocated() balance", async function () {
      await portfolio.connect(admin).deposit(DEPOSIT_AMOUNT);
      expect(await portfolio.unallocated()).to.equal(DEPOSIT_AMOUNT);
    });

    it("emits Deposited", async function () {
      await expect(portfolio.connect(admin).deposit(DEPOSIT_AMOUNT))
        .to.emit(portfolio, "Deposited")
        .withArgs(admin.address, DEPOSIT_AMOUNT);
    });

    it("can be called by any account, not just admin", async function () {
      await token.mint(otherAccount.address, DEPOSIT_AMOUNT);
      await token.connect(otherAccount).approve(await portfolio.getAddress(), DEPOSIT_AMOUNT);
      await expect(portfolio.connect(otherAccount).deposit(DEPOSIT_AMOUNT)).to.not.be.reverted;
      expect(await portfolio.unallocated()).to.equal(DEPOSIT_AMOUNT);
    });

    it("reverts when caller has insufficient allowance", async function () {
      await token.connect(admin).approve(await portfolio.getAddress(), 0n);
      await expect(portfolio.connect(admin).deposit(DEPOSIT_AMOUNT)).to.be.reverted;
    });
  });

  describe("unallocated()", function () {
    const AMOUNT = 500n * 10n ** 6n;

    it("returns zero when no tokens have been deposited", async function () {
      expect(await portfolio.unallocated()).to.equal(0n);
    });

    it("includes tokens sent directly to the portfolio address (no deposit() call)", async function () {
      await token.mint(admin.address, AMOUNT);
      await token.connect(admin).transfer(await portfolio.getAddress(), AMOUNT);
      expect(await portfolio.unallocated()).to.equal(AMOUNT);
    });
  });

  describe("withdrawUnallocated()", function () {
    const AMOUNT = 750n * 10n ** 6n;

    beforeEach(async function () {
      await token.mint(admin.address, AMOUNT);
      await token.connect(admin).approve(await portfolio.getAddress(), AMOUNT);
      await portfolio.connect(admin).deposit(AMOUNT);
    });

    it("sends tokens to the withdrawal address", async function () {
      const before = await token.balanceOf(withdrawalAddress);
      await portfolio.connect(admin).withdrawUnallocated(AMOUNT);
      expect(await token.balanceOf(withdrawalAddress)).to.equal(before + AMOUNT);
    });

    it("reduces unallocated() balance", async function () {
      const half = AMOUNT / 2n;
      await portfolio.connect(admin).withdrawUnallocated(half);
      expect(await portfolio.unallocated()).to.equal(AMOUNT - half);
    });

    it("emits UnallocatedWithdrawn", async function () {
      await expect(portfolio.connect(admin).withdrawUnallocated(AMOUNT))
        .to.emit(portfolio, "UnallocatedWithdrawn")
        .withArgs(AMOUNT);
    });

    it("can be called by a manager (non-admin)", async function () {
      const [, , manager] = await ethers.getSigners();
      await portfolio.connect(admin).addManager(manager.address);
      const before = await token.balanceOf(withdrawalAddress);
      await portfolio.connect(manager).withdrawUnallocated(AMOUNT);
      expect(await token.balanceOf(withdrawalAddress)).to.equal(before + AMOUNT);
    });

    it("reverts when called by non-manager", async function () {
      const [, , nonManager] = await ethers.getSigners();
      await expect(
        portfolio.connect(nonManager).withdrawUnallocated(AMOUNT)
      ).to.be.revertedWithCustomError(portfolio, "OnlyManager");
    });

    it("reverts when amount exceeds unallocated balance", async function () {
      await expect(
        portfolio.connect(admin).withdrawUnallocated(AMOUNT + 1n)
      ).to.be.revertedWithCustomError(portfolio, "InsufficientBalance");
    });

    it("sends to withdrawalAddress, not an arbitrary address", async function () {
      const [, , thirdAccount] = await ethers.getSigners();
      const before = await token.balanceOf(thirdAccount.address);
      await portfolio.connect(admin).withdrawUnallocated(AMOUNT);
      expect(await token.balanceOf(thirdAccount.address)).to.equal(before);
    });
  });

  describe("receive()", function () {
    it("reverts when ETH is sent directly", async function () {
      await expect(
        admin.sendTransaction({
          to: await portfolio.getAddress(),
          value: ethers.parseEther("1"),
        })
      ).to.be.revertedWithCustomError(portfolio, "ETHNotAccepted");
    });
  });

  describe("createEnvelope()", function () {
    let NAME;
    beforeEach(async function () {
      NAME = ethers.encodeBytes32String("mortgage");
    });

    it("returns sequential indices starting at 0", async function () {
      await portfolio.connect(admin).createEnvelope(NAME);
      await portfolio.connect(admin).createEnvelope(ethers.encodeBytes32String("groceries"));
      const addr0 = await portfolio.envelopes(0);
      const addr1 = await portfolio.envelopes(1);
      expect(addr0).to.not.equal(ethers.ZeroAddress);
      expect(addr1).to.not.equal(ethers.ZeroAddress);
      expect(addr0).to.not.equal(addr1);
    });

    it("deploys an Envelope contract with this portfolio as the owner", async function () {
      await portfolio.connect(admin).createEnvelope(NAME);
      const envelopeAddress = await portfolio.envelopes(0);
      const envelope = await ethers.getContractAt("Envelope", envelopeAddress);
      expect(await envelope.portfolio()).to.equal(await portfolio.getAddress());
    });

    it("deployed envelope holds the correct name", async function () {
      await portfolio.connect(admin).createEnvelope(NAME);
      const envelopeAddress = await portfolio.envelopes(0);
      const envelope = await ethers.getContractAt("Envelope", envelopeAddress);
      expect(await envelope.name()).to.equal(NAME);
    });

    it("emits EnvelopeCreated with correct index, address, and name", async function () {
      const txPromise = portfolio.connect(admin).createEnvelope(NAME);
      const txResponse = await txPromise;
      await txResponse.wait();
      const envelopeAddress = await portfolio.envelopes(0);
      await expect(txPromise)
        .to.emit(portfolio, "EnvelopeCreated")
        .withArgs(0n, envelopeAddress, NAME);
    });

    it("reverts when called by a non-manager", async function () {
      const [, , stranger] = await ethers.getSigners();
      await expect(
        portfolio.connect(stranger).createEnvelope(NAME)
      ).to.be.revertedWithCustomError(portfolio, "OnlyManager");
    });

    it("succeeds when called by a granted manager", async function () {
      await portfolio.connect(admin).addManager(otherAccount.address);
      await expect(portfolio.connect(otherAccount).createEnvelope(NAME)).to.not.be.reverted;
    });

    it("admin can create envelopes (implicitly a manager)", async function () {
      await expect(portfolio.connect(admin).createEnvelope(NAME)).to.not.be.reverted;
    });
  });

  describe("deleteEnvelope()", function () {
    beforeEach(async function () {
      await portfolio.connect(admin).createEnvelope(ethers.encodeBytes32String("car"));
    });

    it("sets the envelope slot to address(0)", async function () {
      await portfolio.connect(admin).deleteEnvelope(0);
      expect(await portfolio.envelopes(0)).to.equal(ethers.ZeroAddress);
    });

    it("emits EnvelopeDeleted", async function () {
      await expect(portfolio.connect(admin).deleteEnvelope(0))
        .to.emit(portfolio, "EnvelopeDeleted")
        .withArgs(0n);
    });

    it("reverts when envelope still holds funds", async function () {
      const AMOUNT = 100n * 10n ** 6n;
      await token.mint(admin.address, AMOUNT);
      await token.connect(admin).approve(await portfolio.getAddress(), AMOUNT);
      await portfolio.connect(admin).deposit(AMOUNT);
      await portfolio.connect(admin).allocate(0, AMOUNT);
      await expect(
        portfolio.connect(admin).deleteEnvelope(0)
      ).to.be.revertedWithCustomError(portfolio, "EnvelopeNotEmpty");
    });

    it("reverts when called by non-admin", async function () {
      await expect(
        portfolio.connect(otherAccount).deleteEnvelope(0)
      ).to.be.revertedWithCustomError(portfolio, "OnlyAdmin");
    });

    it("reverts for out-of-bounds index", async function () {
      await expect(
        portfolio.connect(admin).deleteEnvelope(99)
      ).to.be.revertedWithCustomError(portfolio, "EnvelopeNotFound");
    });

    it("reverts for already-deleted slot", async function () {
      await portfolio.connect(admin).deleteEnvelope(0);
      await expect(
        portfolio.connect(admin).deleteEnvelope(0)
      ).to.be.revertedWithCustomError(portfolio, "EnvelopeNotFound");
    });
  });

  describe("allocate()", function () {
    const AMOUNT = 500n * 10n ** 6n;

    beforeEach(async function () {
      await portfolio.connect(admin).createEnvelope(ethers.encodeBytes32String("savings"));
      await token.mint(admin.address, AMOUNT);
      await token.connect(admin).approve(await portfolio.getAddress(), AMOUNT);
      await portfolio.connect(admin).deposit(AMOUNT);
    });

    it("reduces unallocated() balance", async function () {
      await portfolio.connect(admin).allocate(0, AMOUNT);
      expect(await portfolio.unallocated()).to.equal(0n);
    });

    it("increases the envelope token balance", async function () {
      await portfolio.connect(admin).allocate(0, AMOUNT);
      const envelopeAddress = await portfolio.envelopes(0);
      const envelope = await ethers.getContractAt("Envelope", envelopeAddress);
      expect(await envelope.balance()).to.equal(AMOUNT);
    });

    it("emits Allocated", async function () {
      await expect(portfolio.connect(admin).allocate(0, AMOUNT))
        .to.emit(portfolio, "Allocated")
        .withArgs(0n, AMOUNT);
    });

    it("allows partial allocation", async function () {
      const half = AMOUNT / 2n;
      await portfolio.connect(admin).allocate(0, half);
      expect(await portfolio.unallocated()).to.equal(AMOUNT - half);
      const envelopeAddress = await portfolio.envelopes(0);
      const envelope = await ethers.getContractAt("Envelope", envelopeAddress);
      expect(await envelope.balance()).to.equal(half);
    });

    it("reverts when amount exceeds unallocated balance", async function () {
      await expect(
        portfolio.connect(admin).allocate(0, AMOUNT + 1n)
      ).to.be.revertedWithCustomError(portfolio, "InsufficientBalance");
    });

    it("reverts when called by a non-manager", async function () {
      const [, , stranger] = await ethers.getSigners();
      await expect(
        portfolio.connect(stranger).allocate(0, AMOUNT)
      ).to.be.revertedWithCustomError(portfolio, "OnlyManager");
    });

    it("succeeds when called by a granted manager", async function () {
      await portfolio.connect(admin).addManager(otherAccount.address);
      await expect(portfolio.connect(otherAccount).allocate(0, AMOUNT)).to.not.be.reverted;
    });

    it("reverts for out-of-bounds envelope index", async function () {
      await expect(
        portfolio.connect(admin).allocate(99, AMOUNT)
      ).to.be.revertedWithCustomError(portfolio, "EnvelopeNotFound");
    });

    it("reverts for deleted envelope", async function () {
      await portfolio.connect(admin).deleteEnvelope(0);
      await expect(
        portfolio.connect(admin).allocate(0, AMOUNT)
      ).to.be.revertedWithCustomError(portfolio, "EnvelopeNotFound");
    });
  });
});
