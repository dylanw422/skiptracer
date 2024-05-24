import { chromium, devices } from "playwright";
import fs from 'fs';
import csv from 'csv-parser';
import csvWriteStream from 'csv-write-stream';

///////////////////////////////
///// Convert CSV to JSON /////
///////////////////////////////
const readCsvToJson = (csvFilePath) => {
    return new Promise((resolve, reject) => {
        const jsonArray = [];
        fs.createReadStream(csvFilePath)
            .pipe(csv())
            .on('data', (data) => jsonArray.push(data))
            .on('end', () => resolve(jsonArray))
            .on('error', reject);
    });
};

//////////////////////////////
///// Build Progress Bar /////
//////////////////////////////
const progressBar = (current, total) => {
    const width = 50;
    const progress = Math.round((current / total) * 100);
    const completed = Math.round((current / total) * width);
    const remaining = width - completed;
    const bar = `[` + `\u2588`.repeat(completed) + ' '.repeat(remaining) + `] ${progress}%`;
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(bar);
};

//////////////////////
///// Automation /////
//////////////////////
const skiptrace = async (page, context, entry, index, total) => {
    const { firstName, lastName, City, State, Address } = entry;
    let phoneNumber;
    let email;

    // NAVIGATION
    try {
        await page.goto('https://www.cyberbackgroundchecks.com/#', { timeout: 10000, waitUntil: 'domcontentloaded' });
    } catch (error) {
        console.error(`Error navigating to cyberbackgroundchecks for ${firstName} ${lastName}: ${error}`);
        return;
    }

    try {
        await page.locator('#SearchCriteriaViewModel_FirstName').fill(firstName);
        await page.locator('#SearchCriteriaViewModel_LastName').fill(lastName);
        await page.locator('#SearchByName_AddressLine2').fill(`${City}, ${State}`);
        await page.locator('#button-search-by-name').click();
    } catch (error) {
        console.error(`Error filling search form for ${firstName} ${lastName}: ${error}`);
        return;
    }

    // READ DATA
    try {
        const cards = await page.$$('.card.card-hover');
        let phoneFound = false;

        for (const card of cards) {
            try {
                if (phoneFound) break;

                const nameElement = await card.$('.name-given');
                if (!nameElement) continue;

                const searchedName = `${firstName} ${lastName}`;
                function extractFirstLastName(fullName) {
                    const parts = fullName.trim().split(' ');
                    if (parts.length < 2) {
                        return fullName.trim();
                    }
                    const firstName = parts[0];
                    const lastName = parts[parts.length - 1];
                    return `${firstName} ${lastName}`;
                }

                function reverseFirstLastName(fullName) {
                    const parts = fullName.trim().split(' ');
                    if (parts.length < 2) {
                        return fullName.trim();
                    }
                    const firstName = parts[0];
                    const lastName = parts[parts.length - 1];
                    return `${lastName} ${firstName}`;
                }

                const name = extractFirstLastName(await nameElement.innerText());
                const reversedName = reverseFirstLastName(await nameElement.innerText());
                if (name !== searchedName && reversedName !== searchedName) continue;

                const detailsElement = await card.$('.btn.btn-primary.btn-block');
                const detailsLink = await detailsElement.getAttribute('href');
                const newTab = await context.newPage();

                try {
                    await newTab.goto(`https://www.cyberbackgroundchecks.com${detailsLink}`, { timeout: 10000, waitUntil: 'domcontentloaded' });

                    const showMore = await newTab.$('a.expander.collapsed');
                    if (showMore) {
                        await showMore.click();
                    }

                    const addressElements = await newTab.$$('.address-current');
                    for (const addressElement of addressElements) {
                        const dBlockElements = await addressElement.$$('.d-block');
                        if (dBlockElements.length > 0) {
                            const firstDBlockElement = dBlockElements[0];
                            const streetAddress = await firstDBlockElement.innerText();
                            if (streetAddress.trim() === Address.trim()) {
                                const phoneElements = await newTab.$$('.phone');
                                if (phoneElements && phoneElements.length > 1) {
                                    entry.phone = await phoneElements[1].innerText();
                                    const emailElements = await newTab.$$('.email');
                                    if (emailElements && emailElements.length > 0) {
                                        let foundEmail = false;
                                        for (const emailElement of emailElements) {
                                            const email = await emailElement.innerText();
                                            const emailDomain = email.split('@')[1];
                                            if (emailDomain === 'gmail.com') {
                                                entry.email = email;
                                                foundEmail = true;
                                                break;
                                            }
                                        }
                                        if (!foundEmail) {
                                            for (const emailElement of emailElements) {
                                                const email = await emailElement.innerText();
                                                const emailDomain = email.split('@')[1];
                                                if (emailDomain === 'yahoo.com') {
                                                    entry.email = email;
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                    console.log(` ${entry.phone} for ${firstName} ${lastName}`);
                                    phoneFound = true;
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error processing details for ${firstName} ${lastName}: ${error}`);
                } finally {
                    await newTab.close();
                }

            } catch (error) {
                console.error(`Error processing card for ${firstName} ${lastName}: ${error}`);
            }
        }
    } catch (error) {
        console.error(`Error reading data for ${firstName} ${lastName}: ${error}`);
    }

    // UPDATE PROGRESS BAR
    progressBar(index + 1, total);
};

//////////////////////
///// Run Script /////
//////////////////////
(async () => {
    console.log('Running...');
    const csvFilePath = 'leads.csv';
    const browser = await chromium.launch({ headless: false, slowMo: 200 }); // EDIT SlowMo VALUE (200 DEFAULT)
    const context = await browser.newContext(devices['Desktop Chrome']);
    const page = await context.newPage();

    const jsonArray = await readCsvToJson(csvFilePath);

    const totalEntries = jsonArray.length;

    let headers = new Set();
    jsonArray.forEach(obj => Object.keys(obj).forEach(key => headers.add(key)));
    headers.add('phone');
    headers.add('email');

    for (let i = 0; i < totalEntries; i++) {
        await skiptrace(page, context, jsonArray[i], i, totalEntries);
    }

    process.stdout.write('\n');

    await browser.close();

    // Write to CSV
    const csvWriter = csvWriteStream({ headers: Array.from(headers) });
    const writableStream = fs.createWriteStream('leads_with_phone.csv');

    csvWriter.pipe(writableStream);
    jsonArray.forEach(entry => {
        if (entry.phone) {
            csvWriter.write(entry);
        }
    });
    csvWriter.end();

    writableStream.on('finish', () => {
        console.log('Done! Check out your leads_with_phone.csv file!');
    });

})();
