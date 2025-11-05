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

// ✅ GET / route to avoid "Cannot GET /"
app.get('/', (req, res) => {
    res.send('✅ WhatsApp API is running!')
})

let sock // global socket

async function startSock() {
    const { state, saveCreds } = await useMultiFileAuthState('sessions')
    const { version } = await fetchLatestBaileysVersion()

    sock = makeWASocket({
        version,
        auth: state,
        browser: ['Ubuntu', 'Chrome', '22.04.4']
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut

            console.log('🔌 Disconnected. Reconnecting?', shouldReconnect)

            // ✅ Reconnect only if not replaced or logged out
            if (shouldReconnect && statusCode !== DisconnectReason.restartRequired) {
                setTimeout(() => startSock(), 5000) // Delay to avoid CPU loop
            } else {
                console.log('🛑 Not reconnecting. Reason:', DisconnectReason[statusCode])
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp connected!')
        }
    })

    // ✅ Auto-reply to incoming messages
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if (!msg.key.fromMe && msg.message) {
            try {
                const remoteJid = msg.key.remoteJid
                await sock.sendMessage(remoteJid, {
                    text: 'My New WhatsApp Number is 0723051652 (PDBOT🤖)'
                })
                console.log('📩 Auto-replied to', remoteJid)
            } catch (err) {
                console.error('❌ Auto-reply error:', err)
            }
        }
    })
}

// 🟢 Start bot
startSock()

// ✅ API to send messages via Postman
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

// 🟢 Start Express server
app.listen(PORT, () => {
    console.log(`🚀 API running on port ${PORT}`)
})

