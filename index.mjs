import { chromium } from "playwright";
import fs from 'fs';
import csv from 'csv-parser';
import csvWriteStream from 'csv-write-stream'

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

// noinspection SpellCheckingInspection
const skiptrace = async (page, entry) => {
    const { firstName, lastName, City, State } = entry;

    await page.goto('https://www.cyberbackgroundchecks.com/#');
    await page.locator('#SearchCriteriaViewModel_FirstName').fill(firstName);
    await page.locator('#SearchCriteriaViewModel_LastName').fill(lastName);
    await page.locator('#SearchByName_AddressLine2').fill(`${City}, ${State}`);
    await page.locator('#button-search-by-name').click();

    const phoneValues = await page.evaluate(() => {
        const phoneElements = document.querySelectorAll('.phone');
        return Array.from(phoneElements).map(element => {
            const textContent = element.textContent.trim();
            return textContent !== '' ? textContent : null;
        }).filter(value => value !== null);
    });

    entry.phone = phoneValues.join(', ')
};

(async () => {
    const csvFilePath = 'leads.csv';
    const browser = await chromium.launch({ headless: false, slowMo: 100 });
    const page = await browser.newPage();

    const jsonArray = await readCsvToJson(csvFilePath);
    for (const entry of jsonArray) {
        await skiptrace(page, entry);
    }

    await browser.close();

    const csvWriter = csvWriteStream({ headers: Object.keys(jsonArray[0]) });
    const writableStream = fs.createWriteStream('leads_with_phone.csv');

    csvWriter.pipe(writableStream);
    jsonArray.forEach(entry => csvWriter.write(entry));
    csvWriter.end();
})();
