export default {
  command: ['setstickerpackdesc', 'setpackdesc', 'packdesc'],
  category: 'stickers',
  run: async (client, m, args, usedPrefix, command) => {
    try {
      if (!args.length) {
        return m.reply(`《✧》Especifica el nombre del paquete y la nueva descripción.\n> Ejemplo: *${usedPrefix + command} NombreDelPaquete | Nueva Descripción*`)
      }
      const fullText = args.join(' ').trim()
      const parts = fullText.split(/\||•|\//)
      if (parts.length < 2) {
        return m.reply(`《✧》Especifica el nombre del paquete y la nueva descripción.\n> Ejemplo: *${usedPrefix + command} NombreDelPaquete | Nueva Descripción*`)
      }
      const packName = parts[0].trim()
      const desc = parts[1].trim()
      if (!desc || desc.length === 0) {
        return m.reply('《✧》La descripción no puede estar vacía.')
      }
      if (desc.length > 60) {
        return m.reply('《✧》La descripción no puede tener más de 60 caracteres.')
      }
      const db = global.db.data
      if (!db.stickerspack) db.stickerspack = {}
      const packs = db.stickerspack[m.sender]?.packs || []
      if (!packs || packs.length === 0) {
        return m.reply('《✧》No tienes paquetes creados.')
      }
      const pack = packs.find(p => p.name.toLowerCase() === packName.toLowerCase())
      if (!pack) {
        return m.reply(`《✧》No se encontró el paquete de stickers \`${packName}\`.`)
      }
      pack.desc = desc
      pack.lastModified = Date.now().toString()
      db.stickerspack[m.sender].packs = packs
      m.reply(`❀ La descripción del paquete de stickers \`${pack.name}\` ha sido actualizada!`)
    } catch (e) {
      m.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*. Please try again or contact support if the issue persists.\n> [Error: *${e.message}*]`)
    }
  }
}
