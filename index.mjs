import { chromium, devices } from "playwright";
import fs from 'fs';
import csv from 'csv-parser';
import csvWriteStream from 'csv-write-stream'

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
    const bar = ` [\u2588`.repeat(completed) + ' '.repeat(remaining) + `] ${progress}% `;
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(bar);
};

//////////////////////
///// Automation /////
//////////////////////

// noinspection SpellCheckingInspection
const skiptrace = async (page, entry, index, total) => {
    const { firstName, lastName, City, State } = entry;

    // NAVIGATION
    await page.goto('https://www.cyberbackgroundchecks.com/#');
    await page.locator('#SearchCriteriaViewModel_FirstName').fill(firstName);
    await page.locator('#SearchCriteriaViewModel_LastName').fill(lastName);
    await page.locator('#SearchByName_AddressLine2').fill(`${City}, ${State}`);
    await page.locator('#button-search-by-name').click();

    // READ DATA
    const cards = await page.$$('.card.card-hover');
    const phoneNumbers = new Set();
    for (const card of cards) {
        try {
            const addressElement = await card.$('.address');
            if (!addressElement) {
                continue;
            }
            const address = await addressElement.innerText();
            if (address.includes('FL')) { // CHANGE TO THE CORRECT STATE ABBREV
                const numbers = await card.evaluate(() => {
                    const phoneElements = document.querySelectorAll('.phone');
                    return Array.from(phoneElements).map(element => {
                        const textContent = element.textContent.trim();
                        return textContent !== '' ? textContent : null;
                    }).filter(value => value !== null).slice(0, 1);
                });

                numbers.forEach(number => {
                    if (!phoneNumbers.has(number)) {
                        phoneNumbers.add(number);
                    }
                });
            }
        } catch (error) {
            console.error(`Error processing card: ${error}`);
        }
    }

    // UPDATE JSON
    entry.phone = Array.from(phoneNumbers).join(', ');
    entry.age = await page.evaluate(() => {
        const age = document.querySelector('.age');
        if (age) {
            return age.textContent.trim();
        }
    });

    // UPDATE PROGRESS BAR
    progressBar(index + 1, total);
};

//////////////////////
///// Run Script /////
//////////////////////

(async () => {
    console.log('Running...');
    const csvFilePath = 'leads.csv';
    const browser = await chromium.launch({ headless: false, slowMo: 200 }); // EDIT SlowMo VALUE
    const context = await browser.newContext(devices['Desktop Chrome']);
    const page = await context.newPage();

    const jsonArray = await readCsvToJson(csvFilePath);

    const totalEntries = jsonArray.length;

    for (let i = 0; i < totalEntries; i++) {
        await skiptrace(page, jsonArray[i], i, totalEntries);
    }

    process.stdout.write('\n');

    await browser.close();

    const csvWriter = csvWriteStream({ headers: Object.keys(jsonArray[0]) });
    const writableStream = fs.createWriteStream('leads_with_phone.csv');

    csvWriter.pipe(writableStream);
    jsonArray.forEach(entry => csvWriter.write(entry));
    csvWriter.end();

    console.log('Done! Check out your leads_with_phone.csv file!');
})();
