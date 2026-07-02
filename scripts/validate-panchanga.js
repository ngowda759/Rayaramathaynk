#!/usr/bin/env node

const BASE_URL =
  process.env.BASE_URL || "https://rayaramathaynk.vercel.app";

const EXPECTED = {
  tithi: process.env.EXPECTED_TITHI || "",
  nakshatra: process.env.EXPECTED_NAKSHATRA || "",
};

async function main() {
  try {
    const res = await fetch(`${BASE_URL}/api/panchanga/current`);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    console.log("==============");
    console.log("Website Values");
    console.log("==============");
    console.log("Date      :", data.date);
    console.log("Tithi     :", data.tithi);
    console.log("Nakshatra :", data.nakshatra);
    console.log("Yoga      :", data.yoga);
    console.log("Karana    :", data.karana);
    console.log("");

    if (EXPECTED.tithi) {
      console.log(
        `Tithi     : ${data.tithi === EXPECTED.tithi ? "PASS" : "FAIL"}`
      );
      console.log(`Expected   : ${EXPECTED.tithi}`);
      console.log(`Actual     : ${data.tithi}`);
    }

    if (EXPECTED.nakshatra) {
      console.log(
        `Nakshatra : ${
          data.nakshatra === EXPECTED.nakshatra ? "PASS" : "FAIL"
        }`
      );
      console.log(`Expected   : ${EXPECTED.nakshatra}`);
      console.log(`Actual     : ${data.nakshatra}`);
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
