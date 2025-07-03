const express = require('express')
const {
    makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require('@whiskeysockets/baileys')
const fs = require('fs')
const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

let sock // global socket instance

async function startSock() {
    const { state, saveCreds } = await useMultiFileAuthState('sessions')
    const { version } = await fetchLatestBaileysVersion()

    sock = makeWASocket({
        version,
        auth: state,
        // ✅ QR එක හසුරවන්න printQRInTerminal වෙනුවට connection.update භාවිතා කරන්න
        browser: ['Ubuntu', 'Chrome', '22.04.4']
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) {
            console.log('\n📱 Scan this QR to connect WhatsApp:')
            console.log(qr)
        }

        if (connection === 'close') {
            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
            console.log('🔌 Disconnected. Reconnecting...', shouldReconnect)
            if (shouldReconnect) {
                startSock()
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp connected!')
        }
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]

        if (!msg.key.fromMe && msg.message) {
            try {
                const remoteJid = msg.key.remoteJid
                await sock.sendMessage(remoteJid, {
                    text: '🟢 My New WhatsApp Number is 0723051652 (PDBOT🤖)'
                })
                console.log('📩 Auto-replied to', remoteJid)
            } catch (err) {
                console.error('❌ Auto-reply error:', err)
            }
        }
    })
}

// Start bot
startSock()

// ✅ Manual Message Sending Endpoint
app.post('/send-message', async (req, res) => {
    const { number, message } = req.body

    if (!number || !message) {
        return res.status(400).json({ status: 'error', message: 'Missing number or message' })
    }

    try {
        await sock.sendMessage(`${number}@s.whatsapp.net`, { text: message })
        res.json({ status: 'success', to: number, message })
    } catch (err) {
        res.status(500).json({ status: 'error', error: err.message })
    }
})

// ✅ Uptime bot/health check route (for Koyeb/cron-job.org)
app.get('/', (req, res) => {
    res.send('🟢 PDWhatsApp Bot is Running!')
})

// Start Express Server
app.listen(PORT, () => {
    console.log(`🚀 API running at http://localhost:${PORT}`)
})
