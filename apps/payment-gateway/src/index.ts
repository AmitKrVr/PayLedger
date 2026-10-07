import app from './app.js';

const PORT = 5002;

app.listen(PORT, () => {
    console.log(`Payment gateway running on port ${PORT}`);
});