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

    it("acceptAdmin() reverts after cancelPendingAdmin() is called", async function () {
      await portfolio.connect(admin).cancelPendingAdmin();
      await expect(
        portfolio.connect(otherAccount).acceptAdmin()
      ).to.be.revertedWithCustomError(portfolio, "OnlyPendingAdmin");
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

  // ---------------------------------------------------------------------------
  // Manager role
  // ---------------------------------------------------------------------------

  describe("addManager() / removeManager()", function () {
    let manager;

    beforeEach(async function () {
      [, , manager] = await ethers.getSigners();
    });

    it("grants manager role", async function () {
      await portfolio.connect(admin).addManager(manager.address);
      expect(await portfolio.managers(manager.address)).to.be.true;
    });

    it("emits ManagerAdded", async function () {
      await expect(portfolio.connect(admin).addManager(manager.address))
        .to.emit(portfolio, "ManagerAdded")
        .withArgs(manager.address);
    });

    it("reverts addManager when called by non-admin", async function () {
      await expect(
        portfolio.connect(otherAccount).addManager(manager.address)
      ).to.be.revertedWithCustomError(portfolio, "OnlyAdmin");
    });

    it("revokes manager role", async function () {
      await portfolio.connect(admin).addManager(manager.address);
      await portfolio.connect(admin).removeManager(manager.address);
      expect(await portfolio.managers(manager.address)).to.be.false;
    });

    it("emits ManagerRemoved", async function () {
      await portfolio.connect(admin).addManager(manager.address);
      await expect(portfolio.connect(admin).removeManager(manager.address))
        .to.emit(portfolio, "ManagerRemoved")
        .withArgs(manager.address);
    });

    it("reverts removeManager when called by non-admin", async function () {
      await expect(
        portfolio.connect(otherAccount).removeManager(manager.address)
      ).to.be.revertedWithCustomError(portfolio, "OnlyAdmin");
    });
  });

  describe("onlyManager modifier", function () {
    let manager;
    let stranger;

    beforeEach(async function () {
      [, , manager, stranger] = await ethers.getSigners();
      await portfolio.connect(admin).addManager(manager.address);
    });

    it("admin passes onlyManager check", async function () {
      // Admin calling createEnvelope should not revert with OnlyManager
      await expect(
        portfolio.connect(admin).createEnvelope(ethers.encodeBytes32String("test"))
      ).to.not.be.revertedWithCustomError(portfolio, "OnlyManager");
    });

    it("manager passes onlyManager check", async function () {
      await expect(
        portfolio.connect(manager).createEnvelope(ethers.encodeBytes32String("test"))
      ).to.not.be.revertedWithCustomError(portfolio, "OnlyManager");
    });

    it("stranger reverts with OnlyManager", async function () {
      await expect(
        portfolio.connect(stranger).createEnvelope(ethers.encodeBytes32String("test"))
      ).to.be.revertedWithCustomError(portfolio, "OnlyManager");
    });
  });

  // ---------------------------------------------------------------------------
  // Deposit and unallocated balance
  // ---------------------------------------------------------------------------

  describe("deposit() / unallocated()", function () {
    let depositor;
    const DEPOSIT_AMOUNT = 1_000_000n; // 1 USDC (6 decimals)

    beforeEach(async function () {
      [, , depositor] = await ethers.getSigners();
      await token.mint(depositor.address, DEPOSIT_AMOUNT);
      await token.connect(depositor).approve(await portfolio.getAddress(), DEPOSIT_AMOUNT);
    });

    it("transfers tokens into the portfolio", async function () {
      await portfolio.connect(depositor).deposit(DEPOSIT_AMOUNT);
      expect(await token.balanceOf(await portfolio.getAddress())).to.equal(DEPOSIT_AMOUNT);
    });

    it("unallocated() reflects the deposited amount", async function () {
      await portfolio.connect(depositor).deposit(DEPOSIT_AMOUNT);
      expect(await portfolio.unallocated()).to.equal(DEPOSIT_AMOUNT);
    });

    it("emits Deposited event", async function () {
      await expect(portfolio.connect(depositor).deposit(DEPOSIT_AMOUNT))
        .to.emit(portfolio, "Deposited")
        .withArgs(depositor.address, DEPOSIT_AMOUNT);
    });

    it("direct token transfer without deposit() is also counted as unallocated", async function () {
      await token.connect(depositor).transfer(await portfolio.getAddress(), DEPOSIT_AMOUNT);
      expect(await portfolio.unallocated()).to.equal(DEPOSIT_AMOUNT);
    });

    it("unallocated() returns 0 when portfolio holds no tokens", async function () {
      expect(await portfolio.unallocated()).to.equal(0n);
    });

    it("reverts if caller has not approved tokens", async function () {
      const [, , , unapproved] = await ethers.getSigners();
      await token.mint(unapproved.address, DEPOSIT_AMOUNT);
      // No approval — safeTransferFrom should revert
      await expect(
        portfolio.connect(unapproved).deposit(DEPOSIT_AMOUNT)
      ).to.revert(ethers);
    });
  });

  describe("receive() — ETH rejection", function () {
    it("reverts when ETH is sent to portfolio", async function () {
      await expect(
        admin.sendTransaction({ to: await portfolio.getAddress(), value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(portfolio, "ETHNotAccepted");
    });
  });

  describe("withdrawUnallocated()", function () {
    const DEPOSIT_AMOUNT = 2_000_000n;

    beforeEach(async function () {
      await token.mint(admin.address, DEPOSIT_AMOUNT);
      await token.connect(admin).approve(await portfolio.getAddress(), DEPOSIT_AMOUNT);
      await portfolio.connect(admin).deposit(DEPOSIT_AMOUNT);
    });

    it("transfers tokens to the withdrawal address", async function () {
      const before = await token.balanceOf(withdrawalAddress);
      await portfolio.connect(admin).withdrawUnallocated(DEPOSIT_AMOUNT);
      expect(await token.balanceOf(withdrawalAddress)).to.equal(before + DEPOSIT_AMOUNT);
    });

    it("reduces the unallocated balance", async function () {
      await portfolio.connect(admin).withdrawUnallocated(DEPOSIT_AMOUNT / 2n);
      expect(await portfolio.unallocated()).to.equal(DEPOSIT_AMOUNT / 2n);
    });

    it("emits UnallocatedWithdrawn", async function () {
      await expect(portfolio.connect(admin).withdrawUnallocated(DEPOSIT_AMOUNT))
        .to.emit(portfolio, "UnallocatedWithdrawn")
        .withArgs(DEPOSIT_AMOUNT);
    });

    it("reverts when called by non-admin", async function () {
      await expect(
        portfolio.connect(otherAccount).withdrawUnallocated(DEPOSIT_AMOUNT)
      ).to.be.revertedWithCustomError(portfolio, "OnlyAdmin");
    });

    it("reverts when amount exceeds unallocated balance", async function () {
      await expect(
        portfolio.connect(admin).withdrawUnallocated(DEPOSIT_AMOUNT + 1n)
      ).to.be.revertedWithCustomError(portfolio, "InsufficientUnallocated");
    });

    it("sends to withdrawalAddress, not an arbitrary address", async function () {
      // withdrawUnallocated has no destination param — always goes to withdrawalAddress
      const [, , , arbitraryAddress] = await ethers.getSigners();
      const before = await token.balanceOf(arbitraryAddress.address);
      await portfolio.connect(admin).withdrawUnallocated(DEPOSIT_AMOUNT);
      expect(await token.balanceOf(arbitraryAddress.address)).to.equal(before);
    });
  });

  // ---------------------------------------------------------------------------
  // Envelope management
  // ---------------------------------------------------------------------------

  describe("createEnvelope()", function () {
    let manager;
    const NAME = encodeBytes32String("savings");

    beforeEach(async function () {
      [, , manager] = await ethers.getSigners();
      await portfolio.connect(admin).addManager(manager.address);
    });

    it("returns sequential indices starting at 0", async function () {
      const tx1 = await portfolio.connect(manager).createEnvelope(NAME);
      const receipt1 = await tx1.wait();
      const event1 = receipt1.logs.find(
        (l) => l.fragment && l.fragment.name === "EnvelopeCreated"
      );
      expect(event1.args[0]).to.equal(0n);

      const name2 = ethers.encodeBytes32String("rent");
      const tx2 = await portfolio.connect(manager).createEnvelope(name2);
      const receipt2 = await tx2.wait();
      const event2 = receipt2.logs.find(
        (l) => l.fragment && l.fragment.name === "EnvelopeCreated"
      );
      expect(event2.args[0]).to.equal(1n);
    });

    it("stores the envelope address in the envelopes array", async function () {
      await portfolio.connect(manager).createEnvelope(NAME);
      const envelopeAddr = await portfolio.envelopes(0);
      expect(envelopeAddr).to.not.equal(ZeroAddress);
    });

    it("emits EnvelopeCreated with index, address, and name", async function () {
      const tx = portfolio.connect(manager).createEnvelope(NAME);
      await expect(tx)
        .to.emit(portfolio, "EnvelopeCreated")
        .withArgs(0n, (_addr) => _addr !== ZeroAddress, NAME);
    });

    it("deployed envelope has correct portfolio, token, and name", async function () {
      await portfolio.connect(manager).createEnvelope(NAME);
      const envelopeAddr = await portfolio.envelopes(0);
      const Envelope = await ethers.getContractFactory("Envelope");
      const envelope = Envelope.attach(envelopeAddr);
      expect(await envelope.portfolio()).to.equal(await portfolio.getAddress());
      expect(await envelope.token()).to.equal(await token.getAddress());
      expect(await envelope.name()).to.equal(NAME);
    });

    it("reverts when called by a stranger", async function () {
      const [, , , stranger] = await ethers.getSigners();
      await expect(
        portfolio.connect(stranger).createEnvelope(NAME)
      ).to.be.revertedWithCustomError(portfolio, "OnlyManager");
    });
  });

  describe("deleteEnvelope()", function () {
    const NAME = encodeBytes32String("savings");

    beforeEach(async function () {
      await portfolio.connect(admin).createEnvelope(NAME);
    });

    it("sets the slot to address(0)", async function () {
      await portfolio.connect(admin).deleteEnvelope(0);
      expect(await portfolio.envelopes(0)).to.equal(ZeroAddress);
    });

    it("emits EnvelopeDeleted", async function () {
      await expect(portfolio.connect(admin).deleteEnvelope(0))
        .to.emit(portfolio, "EnvelopeDeleted")
        .withArgs(0n);
    });

    it("reverts when called by non-admin", async function () {
      await expect(
        portfolio.connect(otherAccount).deleteEnvelope(0)
      ).to.be.revertedWithCustomError(portfolio, "OnlyAdmin");
    });

    it("reverts when index is out of bounds", async function () {
      await expect(
        portfolio.connect(admin).deleteEnvelope(99)
      ).to.be.revertedWithCustomError(portfolio, "EnvelopeNotFound");
    });

    it("reverts when envelope has a non-zero balance", async function () {
      // Fund the envelope first
      const AMOUNT = 1_000_000n;
      await token.mint(admin.address, AMOUNT);
      await token.connect(admin).approve(await portfolio.getAddress(), AMOUNT);
      await portfolio.connect(admin).deposit(AMOUNT);
      await portfolio.connect(admin).allocate(0, AMOUNT);

      await expect(
        portfolio.connect(admin).deleteEnvelope(0)
      ).to.be.revertedWithCustomError(portfolio, "EnvelopeNotEmpty");
    });

    it("reverts on a previously-deleted slot", async function () {
      await portfolio.connect(admin).deleteEnvelope(0);
      await expect(
        portfolio.connect(admin).deleteEnvelope(0)
      ).to.be.revertedWithCustomError(portfolio, "EnvelopeNotFound");
    });
  });

  describe("allocate()", function () {
    let manager;
    const DEPOSIT_AMOUNT = 5_000_000n;

    beforeEach(async function () {
      [, , manager] = await ethers.getSigners();
      await portfolio.connect(admin).addManager(manager.address);
      await portfolio.connect(admin).createEnvelope(ethers.encodeBytes32String("savings"));
      await token.mint(admin.address, DEPOSIT_AMOUNT);
      await token.connect(admin).approve(await portfolio.getAddress(), DEPOSIT_AMOUNT);
      await portfolio.connect(admin).deposit(DEPOSIT_AMOUNT);
    });

    it("reduces unallocated balance", async function () {
      await portfolio.connect(manager).allocate(0, 1_000_000n);
      expect(await portfolio.unallocated()).to.equal(DEPOSIT_AMOUNT - 1_000_000n);
    });

    it("increases envelope balance", async function () {
      await portfolio.connect(manager).allocate(0, 1_000_000n);
      const envelopeAddr = await portfolio.envelopes(0);
      const Envelope = await ethers.getContractFactory("Envelope");
      const envelope = Envelope.attach(envelopeAddr);
      expect(await envelope.balance()).to.equal(1_000_000n);
    });

    it("emits Allocated", async function () {
      await expect(portfolio.connect(manager).allocate(0, 1_000_000n))
        .to.emit(portfolio, "Allocated")
        .withArgs(0n, 1_000_000n);
    });

    it("reverts when amount exceeds unallocated balance", async function () {
      await expect(
        portfolio.connect(manager).allocate(0, DEPOSIT_AMOUNT + 1n)
      ).to.be.revertedWithCustomError(portfolio, "InsufficientUnallocated");
    });

    it("reverts for invalid envelope index", async function () {
      await expect(
        portfolio.connect(manager).allocate(99, 1_000_000n)
      ).to.be.revertedWithCustomError(portfolio, "EnvelopeNotFound");
    });

    it("reverts when called by a stranger", async function () {
      const [, , , stranger] = await ethers.getSigners();
      await expect(
        portfolio.connect(stranger).allocate(0, 1_000_000n)
      ).to.be.revertedWithCustomError(portfolio, "OnlyManager");
    });
  });

  // ---------------------------------------------------------------------------
  // moveFunds
  // ---------------------------------------------------------------------------

  describe("moveFunds()", function () {
    let manager;
    const AMOUNT = 2_000_000n;

    beforeEach(async function () {
      [, , manager] = await ethers.getSigners();
      await portfolio.connect(admin).addManager(manager.address);
      await portfolio.connect(admin).createEnvelope(ethers.encodeBytes32String("savings"));
      await portfolio.connect(admin).createEnvelope(ethers.encodeBytes32String("rent"));
      await token.mint(admin.address, AMOUNT);
      await token.connect(admin).approve(await portfolio.getAddress(), AMOUNT);
      await portfolio.connect(admin).deposit(AMOUNT);
      await portfolio.connect(admin).allocate(0, AMOUNT);
    });

    it("moves balance from source envelope to destination", async function () {
      const Envelope = await ethers.getContractFactory("Envelope");
      const env0 = Envelope.attach(await portfolio.envelopes(0));
      const env1 = Envelope.attach(await portfolio.envelopes(1));

      await portfolio.connect(manager).moveFunds(0, 1, AMOUNT);

      expect(await env0.balance()).to.equal(0n);
      expect(await env1.balance()).to.equal(AMOUNT);
    });

    it("emits FundsMoved", async function () {
      await expect(portfolio.connect(manager).moveFunds(0, 1, AMOUNT))
        .to.emit(portfolio, "FundsMoved")
        .withArgs(0n, 1n, AMOUNT);
    });

    it("reverts when from == to", async function () {
      await expect(
        portfolio.connect(manager).moveFunds(0, 0, AMOUNT)
      ).to.be.revertedWithCustomError(portfolio, "SameEnvelope");
    });

    it("reverts for invalid source index", async function () {
      await expect(
        portfolio.connect(manager).moveFunds(99, 1, AMOUNT)
      ).to.be.revertedWithCustomError(portfolio, "EnvelopeNotFound");
    });

    it("reverts for invalid destination index", async function () {
      await expect(
        portfolio.connect(manager).moveFunds(0, 99, AMOUNT)
      ).to.be.revertedWithCustomError(portfolio, "EnvelopeNotFound");
    });

    it("reverts when called by a stranger", async function () {
      const [, , , stranger] = await ethers.getSigners();
      await expect(
        portfolio.connect(stranger).moveFunds(0, 1, AMOUNT)
      ).to.be.revertedWithCustomError(portfolio, "OnlyManager");
    });
  });

  // ---------------------------------------------------------------------------
  // withdrawFromEnvelope
  // ---------------------------------------------------------------------------

  describe("withdrawFromEnvelope()", function () {
    let manager;
    const AMOUNT = 3_000_000n;

    beforeEach(async function () {
      [, , manager] = await ethers.getSigners();
      await portfolio.connect(admin).addManager(manager.address);
      await portfolio.connect(admin).createEnvelope(ethers.encodeBytes32String("savings"));
      await token.mint(admin.address, AMOUNT);
      await token.connect(admin).approve(await portfolio.getAddress(), AMOUNT);
      await portfolio.connect(admin).deposit(AMOUNT);
      await portfolio.connect(admin).allocate(0, AMOUNT);
    });

    it("funds land at withdrawalAddress", async function () {
      const before = await token.balanceOf(withdrawalAddress);
      await portfolio.connect(manager).withdrawFromEnvelope(0, AMOUNT);
      expect(await token.balanceOf(withdrawalAddress)).to.equal(before + AMOUNT);
    });

    it("reduces the envelope balance to zero", async function () {
      await portfolio.connect(manager).withdrawFromEnvelope(0, AMOUNT);
      const Envelope = await ethers.getContractFactory("Envelope");
      const envelope = Envelope.attach(await portfolio.envelopes(0));
      expect(await envelope.balance()).to.equal(0n);
    });

    it("emits EnvelopeWithdrawn", async function () {
      await expect(portfolio.connect(manager).withdrawFromEnvelope(0, AMOUNT))
        .to.emit(portfolio, "EnvelopeWithdrawn")
        .withArgs(0n, AMOUNT);
    });

    it("reverts for invalid envelope index", async function () {
      await expect(
        portfolio.connect(manager).withdrawFromEnvelope(99, AMOUNT)
      ).to.be.revertedWithCustomError(portfolio, "EnvelopeNotFound");
    });

    it("reverts when called by a stranger", async function () {
      const [, , , stranger] = await ethers.getSigners();
      await expect(
        portfolio.connect(stranger).withdrawFromEnvelope(0, AMOUNT)
      ).to.be.revertedWithCustomError(portfolio, "OnlyManager");
    });

    it("does NOT send funds to any address other than withdrawalAddress", async function () {
      // Verify the function signature has no destination param (compile-time guarantee)
      // At runtime, funds should only move to withdrawalAddress
      const [, , , arbitraryAddr] = await ethers.getSigners();
      const before = await token.balanceOf(arbitraryAddr.address);
      await portfolio.connect(manager).withdrawFromEnvelope(0, AMOUNT);
      expect(await token.balanceOf(arbitraryAddr.address)).to.equal(before);
    });
  });

  // ---------------------------------------------------------------------------
  // _getEnvelope internal (covered via public functions)
  // ---------------------------------------------------------------------------

  describe("_getEnvelope helper (via public functions)", function () {
    it("reverts with EnvelopeNotFound for out-of-bounds index", async function () {
      await expect(
        portfolio.connect(admin).allocate(0, 1n)
      ).to.be.revertedWithCustomError(portfolio, "EnvelopeNotFound");
    });

    it("reverts with EnvelopeNotFound for deleted slot", async function () {
      await portfolio.connect(admin).createEnvelope(ethers.encodeBytes32String("test"));
      await portfolio.connect(admin).deleteEnvelope(0);
      await expect(
        portfolio.connect(admin).allocate(0, 1n)
      ).to.be.revertedWithCustomError(portfolio, "EnvelopeNotFound");
    });
  });
});
