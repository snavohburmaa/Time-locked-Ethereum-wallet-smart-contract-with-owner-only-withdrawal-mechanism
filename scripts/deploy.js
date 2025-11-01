import hre from "hardhat";
import * as ethers from "ethers";

async function main() {
    const currentTimestampInSeconds = Math.round(Date.now() / 1000);
    const oneYearInSeconds = 365 * 24 * 60 * 60;
    const unlockTime = currentTimestampInSeconds + oneYearInSeconds;

    const lockedAmount = ethers.parseEther("1");
    const MyTest = await hre.artifacts.readArtifact("MyTest");
    const connection = await hre.network.connect();
    const provider = new ethers.BrowserProvider(connection.provider);
    const signer = await provider.getSigner();
    const factory = new ethers.ContractFactory(MyTest.abi, MyTest.bytecode, signer);
    const myTest = await factory.deploy(unlockTime,{value: lockedAmount});
    await myTest.waitForDeployment();
    console.log("MyTest deployed with 1ETH and address:", await myTest.getAddress());
    console.log(MyTest);

    console.log(currentTimestampInSeconds);
    console.log(oneYearInSeconds);
    console.log(unlockTime);
    console.log(lockedAmount);
}
main().catch((error) => {
    console.log(error);
    process.exitCode = 1;
});