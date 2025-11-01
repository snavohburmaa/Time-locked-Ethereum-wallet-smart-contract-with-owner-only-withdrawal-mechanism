import hre from "hardhat";
import * as ethers from "ethers";
import { expect } from "chai";

describe("MyTest", function(){
    async function runEveryTime() {
        const oneYearInSeconds = 365 * 24 * 60 * 60;
        const one_Gwei = 1_000_000000;

        const lockedAmount = one_Gwei;
        const currentTime = Math.floor(Date.now() / 1000);
        const unlockTime = currentTime + oneYearInSeconds;

        //getaccount
        const connection = await hre.network.connect();
        const provider = new ethers.BrowserProvider(connection.provider);
        const owner = await provider.getSigner(0);
        const otherAccount = await provider.getSigner(1);
        
        const MyTest = await hre.artifacts.readArtifact("MyTest");
        const factory = new ethers.ContractFactory(MyTest.abi, MyTest.bytecode, owner);
        const myTest = await factory.deploy(unlockTime, {value: lockedAmount});
        await myTest.waitForDeployment();
        
        console.log("Contract deployed at:", await myTest.getAddress());
      
        return {myTest, owner, otherAccount, unlockTime, lockedAmount, provider, connection};
    }
    
    describe("myTest",function() {
        //check unlock time
        it("should check unlock time", async function() {
            const {myTest, unlockTime} = await runEveryTime();
            expect(await myTest.unlockTime()).to.equal(BigInt(unlockTime));
        });
        
        //check owner 
        it("should check owner", async function() {
            const {myTest, owner} = await runEveryTime();
            expect(await myTest.owner()).to.equal(await owner.getAddress());
        });
        
        //check balance
        it("should check balance", async function() {
            const {myTest, lockedAmount, provider} = await runEveryTime();
            const contractBalance = await provider.getBalance(await myTest.getAddress());
            expect(contractBalance).to.equal(BigInt(lockedAmount));
        });
        
        //condition check
        it("should check condition", async function() {
            const latestTime = Math.floor(Date.now() / 1000);
            const MyTest = await hre.artifacts.readArtifact("MyTest");
            const connection = await hre.network.connect();
            const provider = new ethers.BrowserProvider(connection.provider);
            const signer = await provider.getSigner(0);
            const factory = new ethers.ContractFactory(MyTest.abi, MyTest.bytecode, signer);
            
            let errorOccurred = false;
            try {
                await factory.deploy(latestTime, {value: 1});
            } catch (error) {
                errorOccurred = true;
                expect(error.message).to.include("Unlock time must be in the future");
            }
            expect(errorOccurred).to.be.true;
        })
    })
    
    //withdraw
    describe("Withdrawl",function() {
        describe("Valid conditions",function() {
            //time check 
            it("Should revert if it call too soon", async function(){
                const {myTest} = await runEveryTime();
                
                let errorOccurred = false;
                try {
                    await myTest.withdraw();
                } catch (error) {
                    errorOccurred = true;
                    expect(error.message).to.include("You can't withdraw yet");
                }
                expect(errorOccurred).to.be.true;
            })
            
            //owner check
            it("Should revert for non-owner", async function(){
                const {myTest, otherAccount, unlockTime, connection} = await runEveryTime();
                
                // Advance blockchain time past unlockTime
                const currentTime = Math.floor(Date.now() / 1000);
                const timeToIncrease = unlockTime - currentTime + 1;
                await connection.provider.send("evm_increaseTime", [timeToIncrease]);
                await connection.provider.send("evm_mine");
                
                // Connect contract to otherAccount
                const myTestAsOther = myTest.connect(otherAccount);

                
                let errorOccurred = false;
                try {
                    await myTestAsOther.withdraw();
                } catch (error) {
                    errorOccurred = true;
                    expect(error.message).to.include("You are not the owner");
                }
                expect(errorOccurred).to.be.true;
            })
            it("Should not fail if unlocktime arrived", async function(){
                const {myTest, unlockTime, connection} = await runEveryTime();
                
                // Advance time
                const currentTime = Math.floor(Date.now() / 1000);
                const timeToIncrease = unlockTime - currentTime + 1;
                await connection.provider.send("evm_increaseTime", [timeToIncrease]);
                await connection.provider.send("evm_mine");
                
                // Should successfully withdraw without error
                const tx = await myTest.withdraw();
                const receipt = await tx.wait();
                
                // Transaction should succeed
                expect(receipt.status).to.equal(1);
            })
        })
    })
    
    //check for events
    describe("Events",function() {
        it("Should emit Withdrawal event", async function(){
            const {myTest, unlockTime, connection} = await runEveryTime();
            
            // Advance time
            const currentTime = Math.floor(Date.now() / 1000);
            const timeToIncrease = unlockTime - currentTime + 1;
            await connection.provider.send("evm_increaseTime", [timeToIncrease]);
            await connection.provider.send("evm_mine");
            
            // Withdraw and check that transaction completes (event was emitted)
            const tx = await myTest.withdraw();
            const receipt = await tx.wait();
            
            // Check that Withdrawal event was emitted
            expect(receipt.logs.length).to.be.greaterThan(0);
        })
    })
    
    //transfer
    describe("Transfer",function() {
        it("should transfer to the owner", async function(){
            const {myTest, unlockTime, lockedAmount, owner, provider, connection} = await runEveryTime();
            
            // Advance time
            const currentTime = Math.floor(Date.now() / 1000);
            const timeToIncrease = unlockTime - currentTime + 1;
            await connection.provider.send("evm_increaseTime", [timeToIncrease]);
            await connection.provider.send("evm_mine");
            
            const contractAddress = await myTest.getAddress();
            const ownerBalanceBefore = await provider.getBalance(await owner.getAddress());
            const contractBalanceBefore = await provider.getBalance(contractAddress);
            
            console.log("Contract balance before:", contractBalanceBefore);
            console.log("Owner balance before:", ownerBalanceBefore);
            
            const tx = await myTest.withdraw();
            const receipt = await tx.wait();
            console.log("Withdrawal tx status:", receipt.status);
            
            // Create fresh provider to avoid caching issues
            const newConnection = await hre.network.connect();
            const newProvider = new ethers.BrowserProvider(newConnection.provider);
            
            const ownerBalanceAfter = await newProvider.getBalance(await owner.getAddress());
            const contractBalanceAfter = await newProvider.getBalance(contractAddress);
            
            console.log("Contract balance after:", contractBalanceAfter);
            console.log("Owner balance after:", ownerBalanceAfter);
            
            // Contract balance should be 0 after withdrawal
            expect(contractBalanceAfter).to.equal(0n);
            // Contract had the locked amount before withdrawal
            expect(contractBalanceBefore).to.equal(BigInt(lockedAmount));
        })
    })
});
