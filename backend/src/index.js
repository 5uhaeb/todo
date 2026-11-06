import app from './app.js';
import { query } from './utils/drivebase.js';
await query('SELECT id FROM application_users LIMIT 1');
app.listen(process.env.PORT || 5000, () => console.log('Taskflow backend ready'));
