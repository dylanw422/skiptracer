# skiptracer

# Instructions to Run the Code

This code is designed to extract phone numbers from a website for a list of leads provided in a CSV file.

## Prerequisites

Before running the code, ensure you have Node.js installed on your system. You can download and install it from [here](https://nodejs.org/).

## Installation

1. Clone this repository to your local machine or download the ZIP file and extract it.
2. Navigate to the project directory in your terminal.

## Setup

1. Install the required npm packages by running the following command: `npm install`


## Usage

1. Place your leads CSV file in the project directory and rename it to `leads.csv`.
2. Open the `leads.csv` file and ensure it has the following columns (edit existing columns to exactly match): `firstName`, `lastName`, `City`, `State`. This can be done in your text editor or IDE.
3. Run the code using the following command: `node index.mjs`

This will launch a Chromium browser, extract phone numbers for each lead, and save the results to a new CSV file named `leads_with_phone.csv`.

## Reading New File

Navigate to your directory and open the `leads_with_phone.csv` on your computer using the spreadsheet editor of your choice.

## Additional Notes

- Make sure you have a stable internet connection while running the code as it requires accessing a website.
- You can adjust the browser settings (headless, slowMo) in the code as per your requirements.
- If the browser is not capturing the numbers, considering increasing the `slowMo` value in the code.


