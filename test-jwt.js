const jwt = require('jsonwebtoken');
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1d2xiYnZsZnh6Y3hyaWpwbW9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMTEyMDAsImV4cCI6MjA5MTg4NzIwMH0.YEz3DIcv6QfhABI7cSbJV6XVMY3iFh9XtOntqPZ5TMI';
const secret = '9/I5AVc5IO2m6xn0ezRtNJVYQ3zJdTzaUELP/H3YndtoM2kYQJ9IjZy5/EGxW1rRm/G4Sx8nPDF1tuTn7WPCig==';

try {
  jwt.verify(token, secret);
  console.log('SUCCESS: Secret matches token.');
} catch (e) {
  console.log('FAILED:', e.message);
}
