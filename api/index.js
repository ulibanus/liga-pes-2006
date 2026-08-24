import 'dotenv/config';
import app from './src/server.js';

const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`torneos-api listening on http://localhost:${port}`);
});
