const puppeteer = require('puppeteer-core');
const jobBoardService = require('./jobBoardService');

const BROWSER_CONFIG = {
    headless: true,
    executablePath: process.env.CHROME_BIN || '/home/site/wwwroot/chrome-linux/chrome/google-chrome',
    args: ['--disable-setuid-sandbox',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080',
        '--disable-notifications',
        '--disable-geolocation',
    ],
  };
class GoogleCrawler {
  constructor(options = {}) {
    this.maxPages = options.maxPages || 5;
    this.headless = options.headless ?? 'new';
    this.delayBetweenRequests = options.delayBetweenRequests || 2000;
    this.maxRetries = options.maxRetries || 3;
    this.userAgent = options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    const MAX_INIT_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_INIT_RETRIES; attempt++) {
      try {
        console.log(`Initializing browser. Attempt ${attempt} of ${MAX_INIT_RETRIES}`);
        this.browser = await puppeteer.launch(BROWSER_CONFIG);
        this.page = await this.browser.newPage();
        
        // Set user agent
        await this.page.setUserAgent(this.userAgent);
        
        // Set viewport
        await this.page.setViewport({ width: 1920, height: 1080 });
        
        // Set geolocation permissions to denied
        const context = this.browser.defaultBrowserContext();
        await context.overridePermissions('https://www.google.com', ['geolocation']);
        
        // Automatically handle dialogs (alerts, prompts, etc)
        this.page.on('dialog', async dialog => {
          await dialog.dismiss();
        });
        
        // Enable stealth mode
        await this.page.evaluateOnNewDocument(() => {
          // Pass common bot detection checks
          Object.defineProperty(navigator, 'webdriver', { get: () => false });
          Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
          Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        });
        
        // Block unnecessary resources for better performance
        await this.page.setRequestInterception(true);
        this.page.on('request', (request) => {
          const resourceType = request.resourceType();
          if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
            request.abort();
          } else {
            request.continue();
          }
        });

        console.log('Browser initialized successfully');
        break; // Exit loop on success
      } catch (error) {
        console.error(`Initialization attempt ${attempt} failed:`, error);
        if (attempt === MAX_INIT_RETRIES) {
          throw new Error('Failed to initialize Puppeteer after multiple attempts');
        }
        await this.delay(2000); // Wait before retrying
      }
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async randomDelay() {
    // Random delay between 1 and 3 seconds
    const delay = Math.floor(Math.random() * 2000) + 1000;
    await this.delay(delay);
  }

  async extractLinks() {
    const links = await this.page.evaluate(() => {
      const results = [];
      // Target the main search result links
      const searchResults = document.querySelectorAll('a');
      
      searchResults.forEach(link => {
        const href = link.href;
        const title = link.querySelector('h3') ? link.querySelector('h3').textContent : '';
        
        if (href && !href.includes('google.com')) {
          results.push({
            url: href,
            title: title
          });
        }
      });
      
      return results;
    });

    return links;
  }

  async handleCaptcha() {
    const isCaptchaPresent = await this.page.evaluate(() => {
      return !!document.querySelector('#captcha-form') || 
             !!document.querySelector('.g-recaptcha') ||
             document.title.toLowerCase().includes('unusual traffic');
    });

    if (isCaptchaPresent) {
      console.warn('CAPTCHA detected! Waiting for manual intervention...');
      // Wait for navigation after CAPTCHA is solved
      
      return true;
    }
    return false;
  }

  async crawl(searchQuery) {
    try {
      if (!this.browser) {
        await this.initialize();
      }

      const allLinks = new Set();
      let pageCount = 0;
      const startTime = Date.now();

      try {
        // Navigate to Google
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
        await this.page.goto(searchUrl, { waitUntil: 'networkidle0' });
        
        // Check for initial CAPTCHA
        await this.handleCaptcha();

        while (pageCount < this.maxPages) {
          console.log(`Crawling page ${pageCount + 1}`);

          // Wait for results to load
          await this.page.waitForSelector('div.g', { timeout: 5000 })
            .catch(() => console.warn('Warning: Search results selector not found'));

          // Extract links from current page
          const pageLinks = await this.extractLinks();
          pageLinks.forEach(link => allLinks.add(JSON.stringify(link)));

          // Random delay between actions
          await this.randomDelay();

          // Click next page button if it exists
          const nextButton = await this.page.$('a#pnnext');
          if (!nextButton) {
            console.log('No more pages available');
            break;
          }

          // Click next with random delay
          await this.randomDelay();
          await nextButton.click();
          
          // Check for CAPTCHA after navigation
          const captchaFound = await this.handleCaptcha();
          if (captchaFound) {
            console.log('Continuing after CAPTCHA...');
          }

          pageCount++;
        }

      } catch (error) {
        console.error('Crawl error:', error);
      } finally {
        // Convert Set back to array of objects
        const results = Array.from(allLinks).map(link => JSON.parse(link));
        
        const duration = (Date.now() - startTime) / 1000;
        console.log(`Crawl complete: Found ${results.length} unique links in ${duration} seconds`);
        
        await this.browser.close();
        return results;
      }
    } catch (error) {
      console.error('Crawl error:', error);
      if (this.browser) {
        await this.browser.close();
      }
      throw error; // Rethrow to handle in caller
    }
  }

  async crawlQueue(searchQuery) {
    const jobProcessor = new jobBoardService();

    if (!this.browser) {
      await this.initialize();
    }

    const allLinks = new Set();
    let pageCount = 0;
    const startTime = Date.now();

    try {
      // Navigate to Google with extended timeout
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
      await this.page.goto(searchUrl, { waitUntil: "networkidle0" });
      
      // Check for initial CAPTCHA
      await this.handleCaptcha();

      while (pageCount < this.maxPages) {
        console.log(`Crawling page ${pageCount + 1}`);

        // Wait for results to load with extended timeout
        await this.page.waitForSelector('div.g', { waitUntil: "networkidle0" }) // Increased timeout
          .catch(() => console.warn('Warning: Search results selector not found'));

        // Extract links from current page
        const pageLinks = await this.extractLinks();
        
        pageLinks.forEach(link => jobProcessor.addToCompanyLinkQueue(link.url));

        // Random delay between actions
        await this.randomDelay();

        // Click next page button if it exists
        const nextButton = await this.page.$('a#pnnext');
        if (!nextButton) {
          console.log('No more pages available');
          break;
        }

        // Click next with random delay
        await this.randomDelay();
        await nextButton.click();
        
        let navigationSuccess = false;
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
          try {

            await this.randomDelay();
            navigationSuccess = true;
            break;
          } catch (error) {
            console.error(`Navigation attempt ${attempt} failed:`, error);
            if (attempt === this.maxRetries) throw error;
          }
        }

        if (!navigationSuccess) {
          break;
        }
        
        // Check for CAPTCHA after navigation
        const captchaFound = await this.handleCaptcha();
        if (captchaFound) {
          console.log('Continuing after CAPTCHA...');
        }

        pageCount++;
      }

    } catch (error) {
      console.error('Crawl error:', error);
    } finally {
      // Convert Set back to array of objects
      const results = Array.from(allLinks).map(link => JSON.parse(link));
      
      const duration = (Date.now() - startTime) / 1000;
      console.log(`Crawl complete: Found ${results.length} unique links in ${duration} seconds`);
      
      await this.browser.close();
      return results;
    }
  }
}

// Example usage:
/*
const crawler = new GoogleCrawler({
  maxPages: 3,
  headless: 'new',  // Use 'new' for latest Chrome headless mode
  delayBetweenRequests: 2000
});

crawler.crawl('your search query')
  .then(links => {
    console.log('Found links:', links);
  })
  .catch(error => {
    console.error('Error:', error);
  });
*/

module.exports = GoogleCrawler;