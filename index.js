const lighthouse = require("lighthouse");
const chromeLauncher = require("chrome-launcher");
const url = require("url");
const fs = require("fs");

const urls = [
  "https://www.test.bbc.com/arabic", // home
  "https://www.test.bbc.com/vietnamese/popular/read", // most read
  "https://www.test.bbc.com/afrique/media/video", // most watched
  "https://www.test.bbc.com/pashto/bbc_pashto_radio/programmes/p056fcjb", // OD Radio
  "https://www.test.bbc.com/pashto/bbc_pashto_tv/tv_programmes/w13xttn4", // OD TV
  "https://www.test.bbc.com/afaanoromoo/oduu-23141286", // pgl
  "https://www.test.bbc.com/pashto/afghanistan-52643309?renderer_env=live", // sty
  "https://www.test.bbc.com/korean/bbc_korean_radio/liveradio", // live radio
];

const defaultThresholds = {
  performance: 0.4,
  pwa: 0.4,
  accessibility: 0.4,
  "best-practices": 0.4,
  seo: 0.4,
};

const thresholdOverrides = {
  "/korean/bbc_korean_radio/liveradio": {
    performance: 0.5,
    pwa: 0.5,
    accessibility: 0.5,
  },
  "/pashto/bbc_pashto_radio/programmes/p056fcjb": {
    performance: 1,
    pwa: 0.5,
    accessibility: 0.5,
  },
};

const launchChromeAndRunLighthouse = async (url) => {
  try {
    const chrome = await chromeLauncher.launch({
      chromeFlags: ["--headless", "--no-sandbox"],
    });
    const options = { port: chrome.port };
    const runnerResults = await lighthouse(url, options);
    const results = {
      js: runnerResults.lhr,
      json: runnerResults.report,
    };

    await chrome.kill();
    return results;
  } catch (err) {
    console.log("XXX", err);
  }
};

const processResults = (value, report) => {
  const thresholds = {
    ...defaultThresholds,
    ...thresholdOverrides[value],
  };

  const allPassed = Object.entries(thresholds).every(([category, minScore]) => {
    const { score } = report.categories[category];
    if (score < minScore) {
      console.log(
        `🛑 ${category} score: ${score * 100}/100. Did not meet threshold '${
          minScore * 100
        }'.`
      );
      return false;
    }
    console.log(
      `✅ ${category} score: ${score * 100}/100. Threshold is '${
        minScore * 100
      }'.`
    );
    return true;
  });

  if (!allPassed) {
    console.log(`Not all Ligthouse thresholds were met for ${value}`);
    process.exit(1);
  }
};

(async () => {
  for (const url of urls) {
    const urlObj = new URL(url);
    let dirName = urlObj.host.replace("www.", "");
    if (urlObj.pathname !== "/") {
      dirName = dirName + urlObj.pathname.replace(/\//g, "_");
    }

    if (!fs.existsSync(dirName)) {
      fs.mkdirSync(dirName);
    }
    console.log("Running lighthouse for ", url);
    const results = await launchChromeAndRunLighthouse(url);
    processResults(urlObj.pathname, results.js);
    await fs.writeFile(
      `${dirName}/${results.js["fetchTime"].replace(/:/g, "_")}.json`,
      results.json,
      (err) => {
        if (err) throw err;
      }
    );
  }
})();
