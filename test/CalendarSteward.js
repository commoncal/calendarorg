const { ethers } = require("hardhat");
const { use, expect } = require("chai");
const { solidity } = require("ethereum-waffle");

use(solidity);

describe("Calendar", function () {
  let owner, user, user2, nftCollection, tnft, market, myContract;
    const newPrice = ethers.utils.parseEther("2");
    const taxDeposit = ethers.utils.parseEther("0.1");
    const dayMintPricePlusDeposit = ethers.utils.parseEther("1.1");
    const newPriceWithTaxDeposit = ethers.utils.parseEther("2.1");
    const dayName = "Test Day";
    const changedPrice = ethers.utils.parseEther("2");
    const notEnough = ethers.utils.parseEther("1");

    beforeEach(async function () { 
        let accounts = await ethers.getSigners();
        owner = accounts[0];
        user = accounts[1];
        user2 = accounts[2];
        const DateTime = await ethers.getContractFactory("DateTime");
        dateTime = await DateTime.deploy();

        const CommonCalendar = await ethers.getContractFactory("CommonCalendar");
        const CalendarSteward = await ethers.getContractFactory("CalendarSteward");
        legacyCommonCalendar = await CommonCalendar.deploy(dateTime.address);
        commonCalendar = await CommonCalendar.deploy(dateTime.address);
        calendarSteward = await CalendarSteward.deploy(commonCalendar.address, owner.address);
        await commonCalendar.setSteward(calendarSteward.address);
        await calendarSteward.setLegacyToken(legacyCommonCalendar.address);
        await calendarSteward.setBenefactor(owner.address);
        legacyCommonCalendar.setSteward(owner.address);
        await legacyCommonCalendar.connect(owner).mintItem(user.address, 1, 1)
        await legacyCommonCalendar.connect(owner).mintItem(user.address, 1, 2)
    })

    it("Can mint day", async function () {
        expect(await commonCalendar.exists("101")).to.equal(false);
        expect(await commonCalendar.getMintedDay(1, 1)).to.equal(false);
        await calendarSteward.connect(user).buyOrMint(user.address, 1, 1, newPrice, taxDeposit, dayName, {value: dayMintPricePlusDeposit});
        expect(await commonCalendar.exists("101")).to.equal(true);
        expect(await commonCalendar.getMintedDay(1, 1)).to.equal(true);
        expect(await commonCalendar.ownerOf("101")).to.equal(user.address);
        await calendarSteward.connect(user).depositWeiPatron(user.address, {value: ethers.utils.parseEther("1")});
        expect(await calendarSteward.getDeposit(user.address)).to.eq(ethers.utils.parseEther("1.1"));
    });

    it("Can withdraw deposit", async function () {
        await calendarSteward.connect(user).buyOrMint(user.address, 1, 1, newPrice, taxDeposit, dayName, {value: dayMintPricePlusDeposit});
        await calendarSteward.connect(user).depositWeiPatron(user.address, {value: ethers.utils.parseEther("1")});
        const tooMuch = ethers.utils.parseEther("1.11");
        const withdrawMax = ethers.utils.parseEther("1.099999");
        await expect(calendarSteward.connect(user).withdrawDeposit(tooMuch)).to.be.revertedWith("Withdrawing too much");
        const result = await calendarSteward.getDeposit(user.address);
        await calendarSteward.connect(user).withdrawDeposit(withdrawMax);
        let depositRemaining = await calendarSteward.getDeposit(user.address);
        expect(parseInt(depositRemaining)).to.be.lessThan(parseInt(ethers.utils.parseEther("0.001")));
    });


    it("Can force buy day", async function () {
        const changedName = "Changed Name";
        await calendarSteward.connect(user).buyOrMint(user.address, 1, 1, newPrice, taxDeposit, dayName, {value: dayMintPricePlusDeposit});
        await calendarSteward.connect(user).depositWeiPatron(user.address, {value: ethers.utils.parseEther("1")});
        await calendarSteward.connect(user2).buyOrMint(user.address, 1, 1, changedPrice, taxDeposit, changedName, {value: newPriceWithTaxDeposit});
        await expect(calendarSteward.connect(user2).buyOrMint(user.address, 1, 1, changedPrice, taxDeposit, changedName, {value: notEnough})).to.be.revertedWith("Not enough");
    });

    it("Can mint a day", async function () {
        const changedName = "Changed Name";
        await calendarSteward.connect(user).buyOrMint(user.address, 1, 1, newPrice, taxDeposit, dayName, {value: dayMintPricePlusDeposit});
        await calendarSteward.connect(user).depositWeiPatron(user.address, {value: ethers.utils.parseEther("1")});
        await calendarSteward.connect(user2).buyOrMint(user.address, 1, 1, changedPrice, taxDeposit, changedName, {value: newPriceWithTaxDeposit});
        await expect(calendarSteward.connect(user2).buyOrMint(user.address, 1, 1, changedPrice, taxDeposit, changedName, {value: notEnough})).to.be.revertedWith("Not enough");
    });

    it("Can change price and name", async function () {
        const taxDeposit = ethers.utils.parseEther("0.1");
        const changedPrice = ethers.utils.parseEther("0.1");
        const changedName = "Changed Name";
        const smallerTaxDeposit = ethers.utils.parseEther("0.01");
        const changedPricePlusTax = ethers.utils.parseEther("0.11");
        await calendarSteward.connect(user).buyOrMint(user.address, 1, 2, newPrice, taxDeposit, dayName, {value: dayMintPricePlusDeposit});
        await calendarSteward.connect(user).changeDayNamePrice("102", 1, 2, "King Day", changedPrice);
        expect(await commonCalendar.getDayName(1, 2)).to.equal("King Day");
        await expect(calendarSteward.connect(user2).buyOrMint(user.address, 1, 1, changedPrice, smallerTaxDeposit, changedName, {value: changedPrice})).to.be.revertedWith("Not enough");
        await calendarSteward.connect(user).buyOrMint(user.address, 1, 2, newPrice, smallerTaxDeposit, dayName, {value: changedPricePlusTax});
    });

    it("Test correct tax", async function () {
        const taxDeposit = ethers.utils.parseEther("0.1");
        const price = ethers.utils.parseEther("10");
        const pricePlusTax = ethers.utils.parseEther("10.1");
        await calendarSteward.connect(user).buyOrMint(user.address, 1, 2, price, taxDeposit, dayName, {value: pricePlusTax});
        await ethers.provider.send("evm_increaseTime", [60 * 60 * 24 * 365]); // 1 year
        await calendarSteward._collectPatronage("102");
        const withdrawable = await calendarSteward.depositAbleToWithdraw(user.address);
        expect(withdrawable).to.eq(0);
        const balanceBefore = await ethers.provider.getBalance(owner.address);
        await calendarSteward.withdrawBenefactorFundsTo(owner.address);
        const balanceAfter = await ethers.provider.getBalance(owner.address);
        const difference = balanceAfter.sub(balanceBefore);
        expect(parseInt(difference)).to.be.greaterThan(parseInt(ethers.utils.parseEther("0.09")));
        expect(parseInt(difference)).to.be.lessThan(parseInt(ethers.utils.parseEther("0.11")));
    });

    it("Test foreclose if unpaid", async function () {
        const taxDeposit = ethers.utils.parseEther("0.1");
        const price = ethers.utils.parseEther("10");
        const pricePlusTax = ethers.utils.parseEther("10.1");
        await calendarSteward.connect(user).buyOrMint(user.address, 1, 2, price, taxDeposit, dayName, {value: pricePlusTax});
        await ethers.provider.send("evm_increaseTime", [60 * 60 * 24 * 360]); // almost 1 year
        await calendarSteward._collectPatronage("102");
        expect(await calendarSteward.foreclosed("102")).to.eq(false);
        await ethers.provider.send("evm_increaseTime", [60 * 60 * 24 * 10]); // now its 1 year
        await calendarSteward._collectPatronage("102");
        expect(await calendarSteward.foreclosed("102")).to.eq(true);
        await calendarSteward.connect(user).buyOrMint(user.address, 1, 2, price, taxDeposit, dayName, {value: taxDeposit});
    })

});
