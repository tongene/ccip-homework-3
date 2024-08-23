import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers } from "hardhat";

// Define a test suite for Sender and Receiver contracts.
describe("Sender and Receiver", function () {
  // Define a chain selector for the test scenario.
  const chainSelector = "16015286601757825753";

  // A fixture to deploy necessary contracts before each test.
  async function deployFixture() {
    // Get signers, with the first one typically being the deployer.
    const [owner] = await ethers.getSigners();

    const Router = await ethers.getContractFactory("MockCCIPRouter");
    const Sender = await ethers.getContractFactory("Sender");
    const Receiver = await ethers.getContractFactory("Receiver");
    const BurnMintERC677 = await ethers.getContractFactory("BurnMintERC677");

    // Instantiate the contracts.
    const router = await Router.deploy();
    const link = await BurnMintERC677.deploy(
      "ChainLink Token",
      "LINK",
      18,
      BigInt(1e27)
    );
    const sender = await Sender.deploy(router, link);
    const receiver = await Receiver.deploy(router);

    // Setup allowlists for chains and sender addresses for the test scenario.
    await sender.allowlistDestinationChain(chainSelector, true);
    await receiver.allowlistSourceChain(chainSelector, true);
    await receiver.allowlistSender(sender, true);

    // Return the deployed instances and the owner for use in tests.
    return { owner, sender, receiver, router, link };
  }

  // Test scenario to send a CCIP message from sender to receiver and assess gas usage.
  it("should measure gas consumption of ccipReceive and adjust gas limit", async function () {
    // Deploy contracts and load their instances.
    const { sender, receiver, router } = await loadFixture(deployFixture);

    // Define parameters for the tests.
    const testParams = [0, 50, 99]; // Different iteration values for testing.
    const gasUsageReport = []; // To store reports of gas used for each test.

    // Loop through each test parameter to send messages and record gas usage.
    for (const iterations of testParams) {
      // Send the message with an initial gas limit.
      await sender.sendMessagePayLINK(
        chainSelector,
        receiver,
        iterations,
        400000 // Use the initial hardcoded gas limit for the first send
      );

      // Retrieve gas used from the last message executed by querying the router's events.
      const mockRouterEvents = await router.queryFilter(
        router.filters.MsgExecuted
      );
      const mockRouterEvent = mockRouterEvents[mockRouterEvents.length - 1]; // check last event
      const gasUsed = mockRouterEvent.args.gasUsed;

      // Calculate the new gas limit by increasing the gas used by 10%
      const newGasLimit = Math.ceil(gasUsed.toNumber() * 1.1);

      // Push the report of iterations, gas used, and new gas limit to the array.
      gasUsageReport.push({
        iterations,
        gasUsed: gasUsed.toString(),
        newGasLimit
      });

      // Now send the message again with the adjusted gas limit
      await sender.sendMessagePayLINK(
        chainSelector,
        receiver,
        iterations,
        newGasLimit
      );
    }

    // Log the final report of gas usage for each iteration.
    console.log("Final Gas Usage Report:");
    gasUsageReport.forEach((report) => {
      console.log(
        "Number of iterations %d - Gas used: %d - New Gas Limit: %d",
        report.iterations,
        report.gasUsed,
        report.newGasLimit
      );
    });
  });
});
