const puppeteer = require('puppeteer');

const generarImages = async ({ url }) => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    headless: true, // Cambié a true ya que 'new' puede no ser necesario
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: {
      width: 876,
      height: 2000,
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: false,
      isLandscape: true
    }
  });

  const page = await browser.newPage();
  await page.goto(url, {
    waitUntil: 'domcontentloaded'  // Espera a que la página esté cargada
  });
  // await  page.waitForNetworkIdle({ idleTime: 6000 })
   await page.waitForSelector('#correctiva')

  await page.evaluate(() => document.body.style.background = 'transparent');

  const data = await page.screenshot({
    encoding: 'binary',
    omitBackground: true,
  });

  await browser.close(); // No olvides cerrar el navegador después de usarlo
  return data;
}

module.exports = generarImages;




/* const puppeteer = require('puppeteer');

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
*/