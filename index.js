const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, delay } = require('@whiskeysockets/baileys');
const axios = require('axios');
const fs = require('fs-extra');
const pino = require('pino');
const app = express();

const TG_TOKEN = '8647913571:AAFd5jFINXWIQOdH1qhvfxxmIRn5kzg4j0Q';
const OWNER_ID = '8380969639';

app.get('/', (req, res) => res.send("🚀 Pappy Generator is ONLINE"));

app.get('/pair', async (req, res) => {
    const num = req.query.num;
    if (!num) return res.status(400).send("Number missing");

    // CRITICAL: Use /tmp for Render compatibility
    const authPath = '/tmp/auth_' + Date.now();
    
    try {
        const { state, saveCreds } = await useMultiFileAuthState(authPath);
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: Browsers.ubuntu('Chrome')
        });

        if (!sock.authState.creds.registered) {
            await delay(8000); // Increased delay for stability
            const code = await sock.requestPairingCode(num);
            
            await axios.post(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
                chat_id: OWNER_ID,
                text: `🔢 *PAPPY CODE:* \`${code}\`\n\nEnter this in WhatsApp now!`,
                parse_mode: 'Markdown'
            });
            res.send("Code sent to TG");
        }

        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', async (up) => {
            if (up.connection === 'open') {
                const creds = JSON.parse(fs.readFileSync(`${authPath}/creds.json`));
                const sessionStr = Buffer.from(JSON.stringify(creds)).toString('base64');
                
                await axios.post(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
                    chat_id: OWNER_ID,
                    text: `✅ *SESSION GENERATED!*\n\n/login PAPPY_SESSION;;${sessionStr}`,
                    parse_mode: 'Markdown'
                });
                fs.removeSync(authPath);
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Error: " + err.message);
    }
});

app.listen(process.env.PORT || 3000);
