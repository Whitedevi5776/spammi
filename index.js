const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, delay } = require('@whiskeysockets/baileys');
const axios = require('axios');
const fs = require('fs-extra');
const pino = require('pino');
const app = express();

const TG_TOKEN = '8647913571:AAFd5jFINXWIQOdH1qhvfxxmIRn5kzg4j0Q';
const OWNER_ID = '8380969639';

// 1. Fix the "Cannot GET /" error
app.get('/', (req, res) => {
    res.send("<h1>🚀 Pappy Generator is ONLINE</h1><p>Send /getcode [number] to your Telegram bot to start.</p>");
});

// 2. The Pairing Logic
app.get('/pair', async (req, res) => {
    const num = req.query.num;
    if (!num) return res.status(400).send("Number is missing");

    console.log(`[GEN] Starting pairing for: ${num}`);
    
    // Clear old session to prevent conflicts
    if (fs.existsSync('./temp_auth')) fs.removeSync('./temp_auth');

    const { state, saveCreds } = await useMultiFileAuthState('./temp_auth');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu('Chrome')
    });

    if (!sock.authState.creds.registered) {
        await delay(5000); // 5 second wait for WA handshake
        try {
            const code = await sock.requestPairingCode(num);
            await axios.post(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
                chat_id: OWNER_ID,
                text: `🔢 *PAPPY PAIRING CODE:*\n\n\`${code}\`\n\nEnter this in WhatsApp Linked Devices.`,
                parse_mode: 'Markdown'
            });
            res.send("Code sent to Telegram!");
        } catch (err) {
            console.error(err);
            res.status(500).send("Pairing failed");
        }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (up) => {
        const { connection } = up;
        if (connection === 'open') {
            await delay(2000);
            const creds = JSON.parse(fs.readFileSync('./temp_auth/creds.json', 'utf-8'));
            const sessionStr = Buffer.from(JSON.stringify(creds)).toString('base64');
            
            await axios.post(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
                chat_id: OWNER_ID,
                text: `✅ *SESSION GENERATED!*\n\nCopy this command to your VPS:\n\n\`/login PAPPY_SESSION;;${sessionStr}\``,
                parse_mode: 'Markdown'
            });
            
            // Cleanup to save space
            fs.removeSync('./temp_auth');
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Generator running on port ${PORT}`));
