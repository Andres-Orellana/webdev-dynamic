import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import { default as express } from 'express';
import { default as sqlite3 } from 'sqlite3';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const port = 8080;
const root = path.join(__dirname, 'public');
const template = path.join(__dirname, 'templates');
let template_dir = './templates';
let app = express();
app.use(express.static(root));

const dbPath = path.join(__dirname, 'summary.db');
let db = null;

function openDbIfNeeded() {
  if (!db && fs.existsSync(dbPath)) {
    db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, err => {
      if (err) console.error('Error opening DB:', err.message);
      else console.log('Opened DB:', dbPath);
    });
  }
}



/* -------- By Year -------- */
app.get('/yields/year/:year', (req, res) =>  {
  openDbIfNeeded();
  if (!db) return res.status(500).send('Database not available');

  const year = parseInt(req.params.year);
  if (isNaN(year)) return res.status(400).send('Invalid year parameter');

  const imageSrc = '/images/crops.jpg';
  const imageAlt = 'Crops comparison';

  db.all(
    'SELECT crop, avg_yield FROM yield_summary WHERE year = ? ORDER BY crop',
    [year],
    (err, rows) => {
      if (err) return res.status(500).send('Database error: ' + err.message);
      if (!rows || rows.length === 0)
        return res.status(404).send(`No data found for year ${year}`);

      const crops = rows.map(r => r.crop);
      const yields = rows.map(r => r.avg_yield);
      const tableRows = rows.map(
        r => `<tr><td>${r.crop}</td><td>${r.avg_yield.toFixed(3)}</td></tr>`
      ).join('');

      const chartData = {
        labels: crops,
        datasets: [{
          label: `Average Yield (${year})`,
          data: yields,
          backgroundColor: [
            'rgba(75, 192, 192, 0.6)',
            'rgba(255, 159, 64, 0.6)',
            'rgba(153, 102, 255, 0.6)'
          ],
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      };

      db.all('SELECT DISTINCT year FROM yield_summary ORDER BY year', [], (err2, allYears) => {
        if (err2) return res.status(500).send('Database error: ' + err2.message);

        const yearList = allYears.map(y => y.year);
        const idx = yearList.indexOf(year);
        const prevYear = idx > 0 ? yearList[idx - 1] : yearList[yearList.length - 1];
        const nextYear = idx < yearList.length - 1 ? yearList[idx + 1] : yearList[0];

        const navLinks = `
          <nav style="margin-top:1rem;text-align:center;">
            <a href="/yields/year/${prevYear}"> Previous (${prevYear})</a> |
            <a href="/yields/year/${nextYear}">Next (${nextYear}) </a>
          </nav>
        `;

        fs.readFile(path.join(template, 'temp2.html'), 'utf8', (tErr, tpl) => {
          if (tErr) return res.status(500).send('Error loading template: ' + tErr.message);

          const out = tpl
            .replace(/{{TITLE}}/g, `Crop Yields for ${year}`)
            .replace(/{{DESCRIPTION}}/g, `Average crop yields for the year ${year}.`)
            .replace(/{{IMG_SRC}}/g, imageSrc)
            .replace(/{{IMG_ALT}}/g, imageAlt)
            .replace(/{{TABLE_HEADER}}/g, '<tr><th>Crop</th><th>Average Yield</th></tr>')
            .replace(/{{TABLE_ROWS}}/g, tableRows)
            .replace(/{{CHART_TYPE}}/g, 'bar')
            .replace(/{{CHART_CAPTION}}/g, `Average crop yields in ${year}`)
            .replace(/{{CHART_JSON}}/g, JSON.stringify(chartData))
            .replace(/{{NAV_LINKS}}/g, navLinks);

          res.send(out);
        });
      });
    }
  );
});

/* -------- Compare -------- */
app.get("/yields/compare", (req, res) => {
  openDbIfNeeded();
  if (!db) return res.status(500).send("Database not available");

  db.all("SELECT crop, year, avg_yield FROM yield_summary ORDER BY year, crop", (err, rows) => {
    if (err) return res.status(500).send("Database error");

    fs.readFile(path.join(template, "compare.html"), (err, html_data) => {
      if (err) return res.status(500).send("Template error");

      let filled = html_data.toString().replace("$$$CHART_DATA$$$", JSON.stringify(rows));
      res.status(200).type("html").send(filled);
    });
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});


/* -------- home -------- */
app.get("/", (req, res) => {
  fs.readFile(path.join(template_dir, "index.html"), (err, html_data) => {
    if (err) {
      res.status(500).send("Template error");
      return;
    }
    res.status(200).type("html").send(html_data.toString());
  });
});
