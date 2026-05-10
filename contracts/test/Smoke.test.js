// Smoke test: validates the complete Portfolio + Envelope lifecycle end-to-end.
//
// Unlike unit tests (which test each function in isolation with fresh state),
// these tests run as a sequential story: deploy → deposit → allocate → move →
// withdraw, with state accumulating across `it` blocks inside each `describe`.
//
// To run against a Base mainnet Anvil fork (real USDC), add forking config to
// hardhat.config.js:
//
//   networks: {
//     hardhat: { forking: { url: process.env.BASE_RPC_URL } }
//   }
//
// Then replace MockERC20 with the real USDC address:
//   0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
// and impersonate a whale address that holds USDC to fund the depositor.

import { expect } from "chai";
import { network } from "hardhat";
import { encodeBytes32String, ZeroAddress } from "ethers";

// Conservative gas sanity bounds — not precision targets.
// These should catch regressions (e.g. accidentally quadratic loops)
// without being so tight they break on minor compiler changes.
const GAS_LIMIT = {
  portfolioDeploy: 3_500_000n,
  createEnvelope:   800_000n,
  deposit:          100_000n,
  allocate:          80_000n,
  moveFunds:        120_000n,
  withdrawFromEnvelope: 100_000n,
  withdrawUnallocated:   80_000n,
};

const DECIMALS = 6n;
const usdc = (n) => BigInt(n) * 10n ** DECIMALS; // e.g. usdc(100) → 100_000_000

describe("Smoke Test: Full Portfolio Lifecycle", function () {
  let ethers;
  let portfolio, token;
  let admin, manager, depositor, withdrawalWallet;

  // Indices populated once envelopes are created
  let rentIdx, savingsIdx;

  // State is shared intentionally — each `it` block picks up where the previous left off.
  before(async function () {
    ({ ethers } = await network.connect());
    [admin, manager, depositor, withdrawalWallet] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token = await MockERC20.deploy("Mock USDC", "mUSDC", 6);

    const Portfolio = await ethers.getContractFactory("Portfolio");
    portfolio = await Portfolio.deploy(
      await token.getAddress(),
      withdrawalWallet.address
    );

    const receipt = await portfolio.deploymentTransaction().wait();
    console.log(`    Portfolio deployed: ${receipt.gasUsed.toLocaleString()} gas`);
    expect(receipt.gasUsed).to.be.lessThanOrEqual(GAS_LIMIT.portfolioDeploy);
  });

  it("deployer is set as admin and withdrawal address is correct", async function () {
    expect(await portfolio.admin()).to.equal(admin.address);
    expect(await portfolio.token()).to.equal(await token.getAddress());
    expect(await portfolio.withdrawalAddress()).to.equal(withdrawalWallet.address);
  });

  it("admin grants manager role to a separate hot wallet", async function () {
    await portfolio.connect(admin).addManager(manager.address);
    expect(await portfolio.managers(manager.address)).to.be.true;
  });

  it("manager creates two envelopes (rent, savings)", async function () {
    const tx1 = await portfolio.connect(manager).createEnvelope(encodeBytes32String("rent"));
    const r1 = await tx1.wait();
    console.log(`    createEnvelope (rent): ${r1.gasUsed.toLocaleString()} gas`);
    expect(r1.gasUsed).to.be.lessThanOrEqual(GAS_LIMIT.createEnvelope);
    rentIdx = 0n;

    const tx2 = await portfolio.connect(manager).createEnvelope(encodeBytes32String("savings"));
    const r2 = await tx2.wait();
    console.log(`    createEnvelope (savings): ${r2.gasUsed.toLocaleString()} gas`);
    savingsIdx = 1n;

    // Verify envelopes were deployed at real addresses
    const rentAddr = await portfolio.envelopes(rentIdx);
    const savingsAddr = await portfolio.envelopes(savingsIdx);
    expect(rentAddr).to.not.equal(ZeroAddress);
    expect(savingsAddr).to.not.equal(ZeroAddress);
    expect(rentAddr).to.not.equal(savingsAddr);

    // Verify Envelope contracts store the correct name and portfolio address
    const rent = await ethers.getContractAt("Envelope", rentAddr);
    const savings = await ethers.getContractAt("Envelope", savingsAddr);
    expect(await rent.name()).to.equal(encodeBytes32String("rent"));
    expect(await savings.name()).to.equal(encodeBytes32String("savings"));
    expect(await rent.portfolio()).to.equal(await portfolio.getAddress());
  });

  it("any address can deposit tokens; unallocated balance reflects deposit", async function () {
    const AMOUNT = usdc(1000);
    await token.mint(depositor.address, AMOUNT);
    await token.connect(depositor).approve(await portfolio.getAddress(), AMOUNT);

    const tx = await portfolio.connect(depositor).deposit(AMOUNT);
    const receipt = await tx.wait();
    console.log(`    deposit(1000): ${receipt.gasUsed.toLocaleString()} gas`);
    expect(receipt.gasUsed).to.be.lessThanOrEqual(GAS_LIMIT.deposit);

    expect(await portfolio.unallocated()).to.equal(AMOUNT);
    await expect(tx)
      .to.emit(portfolio, "Deposited")
      .withArgs(depositor.address, AMOUNT);
  });

  it("tokens sent directly to Portfolio address count as unallocated", async function () {
    const DIRECT = usdc(50);
    await token.mint(admin.address, DIRECT);
    await token.connect(admin).transfer(await portfolio.getAddress(), DIRECT);

    // Total unallocated should now be 1050
    expect(await portfolio.unallocated()).to.equal(usdc(1050));
  });

  it("manager allocates 800 to rent envelope", async function () {
    const tx = await portfolio.connect(manager).allocate(rentIdx, usdc(800));
    const receipt = await tx.wait();
    console.log(`    allocate(800 → rent): ${receipt.gasUsed.toLocaleString()} gas`);
    expect(receipt.gasUsed).to.be.lessThanOrEqual(GAS_LIMIT.allocate);

    const rentAddr = await portfolio.envelopes(rentIdx);
    const rent = await ethers.getContractAt("Envelope", rentAddr);
    expect(await rent.balance()).to.equal(usdc(800));
    expect(await portfolio.unallocated()).to.equal(usdc(250));
  });

  it("tokens sent directly to Envelope address appear in envelope.balance()", async function () {
    // Direct ERC-20 transfers bypass Portfolio entirely and still land in the envelope
    const savingsAddr = await portfolio.envelopes(savingsIdx);
    const DIRECT = usdc(100);
    await token.mint(depositor.address, DIRECT);
    await token.connect(depositor).transfer(savingsAddr, DIRECT);

    const savings = await ethers.getContractAt("Envelope", savingsAddr);
    expect(await savings.balance()).to.equal(DIRECT);
  });

  it("manager moves 300 from rent to savings", async function () {
    const tx = await portfolio.connect(manager).moveFunds(rentIdx, savingsIdx, usdc(300));
    const receipt = await tx.wait();
    console.log(`    moveFunds(300, rent→savings): ${receipt.gasUsed.toLocaleString()} gas`);
    expect(receipt.gasUsed).to.be.lessThanOrEqual(GAS_LIMIT.moveFunds);

    const rentAddr = await portfolio.envelopes(rentIdx);
    const savingsAddr = await portfolio.envelopes(savingsIdx);
    const rent = await ethers.getContractAt("Envelope", rentAddr);
    const savings = await ethers.getContractAt("Envelope", savingsAddr);

    expect(await rent.balance()).to.equal(usdc(500));   // 800 - 300
    expect(await savings.balance()).to.equal(usdc(400)); // 100 direct + 300 moved
  });

  it("manager withdraws from rent envelope to withdrawal address only", async function () {
    const before = await token.balanceOf(withdrawalWallet.address);

    const tx = await portfolio.connect(manager).withdrawFromEnvelope(rentIdx, usdc(500));
    const receipt = await tx.wait();
    console.log(`    withdrawFromEnvelope(500): ${receipt.gasUsed.toLocaleString()} gas`);
    expect(receipt.gasUsed).to.be.lessThanOrEqual(GAS_LIMIT.withdrawFromEnvelope);

    expect(await token.balanceOf(withdrawalWallet.address)).to.equal(before + usdc(500));

    // Confirm funds did NOT go anywhere else
    const rentAddr = await portfolio.envelopes(rentIdx);
    const rent = await ethers.getContractAt("Envelope", rentAddr);
    expect(await rent.balance()).to.equal(0n);
  });

  it("admin withdraws remaining unallocated balance to withdrawal address", async function () {
    const unallocated = await portfolio.unallocated();
    expect(unallocated).to.equal(usdc(250)); // 1050 deposited - 800 allocated

    const before = await token.balanceOf(withdrawalWallet.address);
    const tx = await portfolio.connect(admin).withdrawUnallocated(unallocated);
    const receipt = await tx.wait();
    console.log(`    withdrawUnallocated(250): ${receipt.gasUsed.toLocaleString()} gas`);
    expect(receipt.gasUsed).to.be.lessThanOrEqual(GAS_LIMIT.withdrawUnallocated);

    expect(await token.balanceOf(withdrawalWallet.address)).to.equal(before + unallocated);
    expect(await portfolio.unallocated()).to.equal(0n);
  });

  it("admin can delete an empty envelope", async function () {
    // rent envelope is now empty (balance = 0)
    await portfolio.connect(admin).deleteEnvelope(rentIdx);
    expect(await portfolio.envelopes(rentIdx)).to.equal(ZeroAddress);
  });

  describe("Admin handoff mid-lifecycle", function () {
    let newAdmin;

    before(async function () {
      [, , , , newAdmin] = await ethers.getSigners();
    });

    it("proposeAdmin + acceptAdmin completes a two-step transfer", async function () {
      await portfolio.connect(admin).proposeAdmin(newAdmin.address);
      expect(await portfolio.pendingAdmin()).to.equal(newAdmin.address);

      await portfolio.connect(newAdmin).acceptAdmin();
      expect(await portfolio.admin()).to.equal(newAdmin.address);
      expect(await portfolio.pendingAdmin()).to.equal(ZeroAddress);
    });

    it("new admin can perform privileged operations", async function () {
      // New admin can change the withdrawal address
      await portfolio.connect(newAdmin).setWithdrawalAddress(withdrawalWallet.address);
      expect(await portfolio.withdrawalAddress()).to.equal(withdrawalWallet.address);
    });

    it("old admin is denied admin operations after transfer", async function () {
      await expect(
        portfolio.connect(admin).setWithdrawalAddress(withdrawalWallet.address)
      ).to.be.revertedWithCustomError(portfolio, "OnlyAdmin");
    });

    it("previously-granted manager still operates under new admin", async function () {
      // manager was granted by the old admin; role should persist
      expect(await portfolio.managers(manager.address)).to.be.true;

      // Manager can still move funds in the savings envelope (which still has 400)
      const savingsAddr = await portfolio.envelopes(savingsIdx);
      const savings = await ethers.getContractAt("Envelope", savingsAddr);
      const balanceBefore = await savings.balance();

      // Deposit more so there's something to move
      await token.mint(depositor.address, usdc(100));
      await token.connect(depositor).approve(await portfolio.getAddress(), usdc(100));
      await portfolio.connect(depositor).deposit(usdc(100));

      // Create a new envelope and allocate into it
      await portfolio.connect(manager).createEnvelope(encodeBytes32String("emergency"));
      const emergencyIdx = 2n;

      await portfolio.connect(manager).allocate(emergencyIdx, usdc(100));
      const emergencyAddr = await portfolio.envelopes(emergencyIdx);
      const emergency = await ethers.getContractAt("Envelope", emergencyAddr);
      expect(await emergency.balance()).to.equal(usdc(100));
      expect(await savings.balance()).to.equal(balanceBefore); // unaffected
    });
  });
});
