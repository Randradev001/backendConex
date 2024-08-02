const puppeteer = require('puppeteer');

const generarImages = async({url})=>{
 
    const browser = await puppeteer.launch({
      executablePath: '/usr/bin/chromium-browser',
      headless:'new',
      defaultViewport: {
          width:876,
          height:2000,
          deviceScaleFactor:1,
          isMobile:true,
          hasTouch:false,
          isLandscape:true
      } 
    })
    const page = await browser.newPage();
    await page.goto(url,{
       waitUntil: 'domcontentloaded'  // permite esperar a que la página se encuentra cargada
    })
   // await  page.waitForNetworkIdle({ idleTime: 3000 })
    await page.waitForSelector('#correctiva')

    await page.evaluate(() => document.body.style.background = 'transparent');
   
    const data = await page.screenshot({
     //  type: 'jpeg',
     //  quality: 100,
      encoding: 'binary',
      omitBackground: true,
    });
  return data

}

module.exports = generarImages;