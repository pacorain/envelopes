import { expect } from "chai";
import { network } from "hardhat";
import { encodeBytes32String, ZeroAddress } from "ethers";

describe("Portfolio", function () {
  let portfolio;
  let token;
  let admin;
  let otherAccount;
  let withdrawalAddress;
  let ethers;

  beforeEach(async function () {
    ({ ethers } = await network.connect());
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
      const deployed = await Portfolio.deploy(await token.getAddress(), withdrawalAddress);
      await expect(deployed.deploymentTransaction())
        .to.emit(deployed, "AdminTransferred")
        .withArgs(ZeroAddress, admin.address);
    });

    it("emits WithdrawalAddressSet on deploy", async function () {
      const Portfolio = await ethers.getContractFactory("Portfolio");
      const deployed = await Portfolio.deploy(await token.getAddress(), withdrawalAddress);
      await expect(deployed.deploymentTransaction())
        .to.emit(deployed, "WithdrawalAddressSet")
        .withArgs(withdrawalAddress);
    });

    it("reverts when token address is zero", async function () {
      const Portfolio = await ethers.getContractFactory("Portfolio");
      await expect(
        Portfolio.deploy(ZeroAddress, withdrawalAddress)
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
        Portfolio.deploy(await token.getAddress(), ZeroAddress)
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
        portfolio.connect(admin).proposeAdmin(ZeroAddress)
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
      expect(await portfolio.pendingAdmin()).to.equal(ZeroAddress);
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
      expect(await portfolio.pendingAdmin()).to.equal(ZeroAddress);
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

    it("reverts when there is no pending proposal", async function () {
      await portfolio.connect(admin).cancelPendingAdmin();
      await expect(
        portfolio.connect(admin).cancelPendingAdmin()
      ).to.be.revertedWithCustomError(portfolio, "NoPendingAdminProposal");
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
        portfolio.connect(admin).addManager(ZeroAddress)
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

    it("reverts for zero address", async function () {
      await expect(
        portfolio.connect(admin).removeManager(ZeroAddress)
      ).to.be.revertedWithCustomError(portfolio, "ZeroAddress");
    });

    it("reverts when address is not a manager", async function () {
      const [, , nonManager] = await ethers.getSigners();
      await expect(
        portfolio.connect(admin).removeManager(nonManager.address)
      ).to.be.revertedWithCustomError(portfolio, "NotAManager");
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
        portfolio.connect(admin).setWithdrawalAddress(ZeroAddress)
      ).to.be.revertedWithCustomError(portfolio, "ZeroAddress");
    });
  });

  describe("deposit()", function () {
    const DEPOSIT_AMOUNT = 1000n * 10n ** 6n;

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
      await expect(portfolio.connect(otherAccount).deposit(DEPOSIT_AMOUNT)).to.not.be.revert(ethers);
      expect(await portfolio.unallocated()).to.equal(DEPOSIT_AMOUNT);
    });

    it("reverts when caller has insufficient allowance", async function () {
      await token.connect(admin).approve(await portfolio.getAddress(), 0n);
      await expect(portfolio.connect(admin).deposit(DEPOSIT_AMOUNT)).to.be.revert(ethers);
    });

    it("reverts on zero-amount deposit", async function () {
      await expect(portfolio.connect(admin).deposit(0n))
        .to.be.revertedWithCustomError(portfolio, "ZeroAmount");
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
      NAME = encodeBytes32String("mortgage");
    });

    it("returns sequential indices starting at 0", async function () {
      await portfolio.connect(admin).createEnvelope(NAME);
      await portfolio.connect(admin).createEnvelope(encodeBytes32String("groceries"));
      const addr0 = await portfolio.envelopes(0);
      const addr1 = await portfolio.envelopes(1);
      expect(addr0).to.not.equal(ZeroAddress);
      expect(addr1).to.not.equal(ZeroAddress);
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
      await expect(portfolio.connect(admin).createEnvelope(NAME))
        .to.emit(portfolio, "EnvelopeCreated")
        .withArgs(0n, (addr) => addr !== ZeroAddress, NAME);
    });

    it("reverts when called by a non-manager", async function () {
      const [, , stranger] = await ethers.getSigners();
      await expect(
        portfolio.connect(stranger).createEnvelope(NAME)
      ).to.be.revertedWithCustomError(portfolio, "OnlyManager");
    });

    it("succeeds when called by a granted manager", async function () {
      await portfolio.connect(admin).addManager(otherAccount.address);
      await expect(portfolio.connect(otherAccount).createEnvelope(NAME)).to.not.be.revert(ethers);
    });

    it("admin can create envelopes (implicitly a manager)", async function () {
      await expect(portfolio.connect(admin).createEnvelope(NAME)).to.not.be.revert(ethers);
    });
  });

  describe("deleteEnvelope()", function () {
    beforeEach(async function () {
      await portfolio.connect(admin).createEnvelope(encodeBytes32String("car"));
    });

    it("sets the envelope slot to address(0)", async function () {
      await portfolio.connect(admin).deleteEnvelope(0);
      expect(await portfolio.envelopes(0)).to.equal(ZeroAddress);
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
      await portfolio.connect(admin).createEnvelope(encodeBytes32String("savings"));
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
      await expect(portfolio.connect(otherAccount).allocate(0, AMOUNT)).to.not.be.revert(ethers);
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

  describe("moveFunds()", function () {
    const AMOUNT = 300n * 10n ** 6n;
    let envelopeA, envelopeB;

    beforeEach(async function () {
      await portfolio.connect(admin).createEnvelope(encodeBytes32String("groceries"));
      await portfolio.connect(admin).createEnvelope(encodeBytes32String("savings"));
      envelopeA = await ethers.getContractAt("Envelope", await portfolio.envelopes(0));
      envelopeB = await ethers.getContractAt("Envelope", await portfolio.envelopes(1));

      await token.mint(admin.address, AMOUNT);
      await token.connect(admin).approve(await portfolio.getAddress(), AMOUNT);
      await portfolio.connect(admin).deposit(AMOUNT);
      await portfolio.connect(admin).allocate(0, AMOUNT);
    });

    it("moves balance from source envelope to destination", async function () {
      await portfolio.connect(admin).moveFunds(0, 1, AMOUNT);
      expect(await envelopeA.balance()).to.equal(0n);
      expect(await envelopeB.balance()).to.equal(AMOUNT);
    });

    it("supports partial moves", async function () {
      const half = AMOUNT / 2n;
      await portfolio.connect(admin).moveFunds(0, 1, half);
      expect(await envelopeA.balance()).to.equal(AMOUNT - half);
      expect(await envelopeB.balance()).to.equal(half);
    });

    it("emits FundsMoved", async function () {
      await expect(portfolio.connect(admin).moveFunds(0, 1, AMOUNT))
        .to.emit(portfolio, "FundsMoved")
        .withArgs(0n, 1n, AMOUNT);
    });

    it("reverts when from == to", async function () {
      await expect(
        portfolio.connect(admin).moveFunds(0, 0, AMOUNT)
      ).to.be.revertedWithCustomError(portfolio, "SameEnvelope");
    });

    it("reverts for invalid source envelope", async function () {
      await expect(
        portfolio.connect(admin).moveFunds(99, 1, AMOUNT)
      ).to.be.revertedWithCustomError(portfolio, "EnvelopeNotFound");
    });

    it("reverts for invalid destination envelope", async function () {
      await expect(
        portfolio.connect(admin).moveFunds(0, 99, AMOUNT)
      ).to.be.revertedWithCustomError(portfolio, "EnvelopeNotFound");
    });

    it("reverts for deleted source envelope", async function () {
      await portfolio.connect(admin).moveFunds(0, 1, AMOUNT);
      await portfolio.connect(admin).deleteEnvelope(0);
      await expect(
        portfolio.connect(admin).moveFunds(0, 1, AMOUNT)
      ).to.be.revertedWithCustomError(portfolio, "EnvelopeNotFound");
    });

    it("reverts for deleted destination envelope", async function () {
      // drain envelope 1 so it can be deleted, then attempt to move into it
      await portfolio.connect(admin).createEnvelope(encodeBytes32String("temp"));
      await portfolio.connect(admin).deleteEnvelope(2);
      await expect(
        portfolio.connect(admin).moveFunds(0, 2, AMOUNT)
      ).to.be.revertedWithCustomError(portfolio, "EnvelopeNotFound");
    });

    it("reverts when called by a non-manager", async function () {
      const [, , stranger] = await ethers.getSigners();
      await expect(
        portfolio.connect(stranger).moveFunds(0, 1, AMOUNT)
      ).to.be.revertedWithCustomError(portfolio, "OnlyManager");
    });

    it("succeeds when called by a granted manager", async function () {
      await portfolio.connect(admin).addManager(otherAccount.address);
      await expect(portfolio.connect(otherAccount).moveFunds(0, 1, AMOUNT)).to.not.revert(ethers);
    });
  });

  describe("withdrawFromEnvelope()", function () {
    const AMOUNT = 400n * 10n ** 6n;

    beforeEach(async function () {
      await portfolio.connect(admin).createEnvelope(encodeBytes32String("rent"));
      await token.mint(admin.address, AMOUNT);
      await token.connect(admin).approve(await portfolio.getAddress(), AMOUNT);
      await portfolio.connect(admin).deposit(AMOUNT);
      await portfolio.connect(admin).allocate(0, AMOUNT);
    });

    it("sends funds to the withdrawal address", async function () {
      const before = await token.balanceOf(withdrawalAddress);
      await portfolio.connect(admin).withdrawFromEnvelope(0, AMOUNT);
      expect(await token.balanceOf(withdrawalAddress)).to.equal(before + AMOUNT);
    });

    it("reduces the envelope balance", async function () {
      const envelopeAddr = await portfolio.envelopes(0);
      const envelope = await ethers.getContractAt("Envelope", envelopeAddr);
      await portfolio.connect(admin).withdrawFromEnvelope(0, AMOUNT);
      expect(await envelope.balance()).to.equal(0n);
    });

    it("emits EnvelopeWithdrawn", async function () {
      await expect(portfolio.connect(admin).withdrawFromEnvelope(0, AMOUNT))
        .to.emit(portfolio, "EnvelopeWithdrawn")
        .withArgs(0n, AMOUNT);
    });

    it("funds land at withdrawalAddress, not an arbitrary address", async function () {
      const [, , thirdAccount] = await ethers.getSigners();
      const before = await token.balanceOf(thirdAccount.address);
      await portfolio.connect(admin).withdrawFromEnvelope(0, AMOUNT);
      expect(await token.balanceOf(thirdAccount.address)).to.equal(before);
    });

    it("manager withdrawal also sends only to withdrawalAddress", async function () {
      await portfolio.connect(admin).addManager(otherAccount.address);
      const [, , thirdAccount] = await ethers.getSigners();
      const beforeWithdrawal = await token.balanceOf(withdrawalAddress);
      const beforeThird = await token.balanceOf(thirdAccount.address);
      await portfolio.connect(otherAccount).withdrawFromEnvelope(0, AMOUNT);
      expect(await token.balanceOf(withdrawalAddress)).to.equal(beforeWithdrawal + AMOUNT);
      expect(await token.balanceOf(thirdAccount.address)).to.equal(beforeThird);
    });

    it("reverts for invalid envelope index", async function () {
      await expect(
        portfolio.connect(admin).withdrawFromEnvelope(99, AMOUNT)
      ).to.be.revertedWithCustomError(portfolio, "EnvelopeNotFound");
    });

    it("reverts for deleted envelope", async function () {
      await portfolio.connect(admin).withdrawFromEnvelope(0, AMOUNT);
      await portfolio.connect(admin).deleteEnvelope(0);
      await expect(
        portfolio.connect(admin).withdrawFromEnvelope(0, AMOUNT)
      ).to.be.revertedWithCustomError(portfolio, "EnvelopeNotFound");
    });

    it("reverts when called by a non-manager", async function () {
      const [, , stranger] = await ethers.getSigners();
      await expect(
        portfolio.connect(stranger).withdrawFromEnvelope(0, AMOUNT)
      ).to.be.revertedWithCustomError(portfolio, "OnlyManager");
    });

    it("succeeds when called by a granted manager", async function () {
      await portfolio.connect(admin).addManager(otherAccount.address);
      await expect(
        portfolio.connect(otherAccount).withdrawFromEnvelope(0, AMOUNT)
      ).to.not.revert(ethers);
    });

    it("reverts when envelope has insufficient balance", async function () {
      await expect(
        portfolio.connect(admin).withdrawFromEnvelope(0, AMOUNT + 1n)
      ).to.revert(ethers);
    });
  });

  describe("rescueTokenFromEnvelope()", function () {
    const AMOUNT = 200n * 10n ** 18n;
    let strayToken;

    beforeEach(async function () {
      await portfolio.connect(admin).createEnvelope(encodeBytes32String("savings"));
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      strayToken = await MockERC20.deploy("Stray Token", "STR", 18);
      await strayToken.mint(await portfolio.envelopes(0), AMOUNT);
    });

    it("transfers the stray token to the withdrawal address", async function () {
      const before = await strayToken.balanceOf(withdrawalAddress);
      await portfolio.connect(admin).rescueTokenFromEnvelope(0, await strayToken.getAddress(), AMOUNT);
      expect(await strayToken.balanceOf(withdrawalAddress)).to.equal(before + AMOUNT);
    });

    it("emits TokenRescued", async function () {
      await expect(
        portfolio.connect(admin).rescueTokenFromEnvelope(0, await strayToken.getAddress(), AMOUNT)
      )
        .to.emit(portfolio, "TokenRescued")
        .withArgs(0n, await strayToken.getAddress(), AMOUNT);
    });

    it("reverts when trying to rescue the primary token", async function () {
      await expect(
        portfolio.connect(admin).rescueTokenFromEnvelope(0, await token.getAddress(), AMOUNT)
      ).to.be.revertedWithCustomError(portfolio, "CannotRescuePrimaryToken");
    });

    it("reverts for invalid envelope index", async function () {
      await expect(
        portfolio.connect(admin).rescueTokenFromEnvelope(99, await strayToken.getAddress(), AMOUNT)
      ).to.be.revertedWithCustomError(portfolio, "EnvelopeNotFound");
    });

    it("reverts when called by a non-admin", async function () {
      await expect(
        portfolio.connect(otherAccount).rescueTokenFromEnvelope(0, await strayToken.getAddress(), AMOUNT)
      ).to.be.revertedWithCustomError(portfolio, "OnlyAdmin");
    });

    it("reverts for zero-address token", async function () {
      await expect(
        portfolio.connect(admin).rescueTokenFromEnvelope(0, ZeroAddress, AMOUNT)
      ).to.be.revertedWithCustomError(portfolio, "ZeroAddress");
    });

    it("funds land at withdrawalAddress, not an arbitrary address", async function () {
      const [, , thirdAccount] = await ethers.getSigners();
      const before = await strayToken.balanceOf(thirdAccount.address);
      await portfolio.connect(admin).rescueTokenFromEnvelope(0, await strayToken.getAddress(), AMOUNT);
      expect(await strayToken.balanceOf(thirdAccount.address)).to.equal(before);
    });
  });
});
