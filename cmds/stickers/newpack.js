export default {
  command: ['newpack', 'newstickerpack'],
  category: 'stickers',
  run: async (client, m, args, usedPrefix, command) => {
    try {
      const db = global.db.data
      const user = db.users[m.sender] || {}
      const dev = user.name || m.pushName || 'Desconocido'
      const name = args.join(' ').trim()
      if (!name || name.length < 4 || name.length > 64) {
        return m.reply('《✧》El nombre del paquete de stickers debe tener entre 4 y 64 caracteres.')
      }
      if (!db.stickerspack) db.stickerspack = {}
      if (!db.stickerspack[m.sender]) db.stickerspack[m.sender] = { packs: [] }
      const packs = db.stickerspack[m.sender].packs || []
      if (packs.find(p => p.name.toLowerCase() === name.toLowerCase())) {
        return m.reply('《✧》Ya tienes un paquete con ese nombre.')
      }
      const newPack = { id: Date.now().toString(), lastModified: Date.now().toString(), name, author: 'ʏᴜᴋɪ 🧠 Wᴀʙᴏᴛ', desc: `Paquete de stickers creado por ${dev}`, stickers: [], spackpublic: 0 }
      packs.push(newPack)
      db.stickerspack[m.sender].packs = packs
      m.reply(`《✧》El paquete de stickers \`${name}\` ha sido creado exitosamente!\n> Puedes agregar stickers respondiendo a uno usando *${usedPrefix}addsticker ${name}*!`)
    } catch (e) {
      m.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*. Please try again or contact support if the issue persists.\n> [Error: *${e.message}*]`)
    }
  }
}
