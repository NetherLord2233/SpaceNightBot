export default {
  command: ['delpack'],
  category: 'stickers',
  run: async (client, m, args, usedPrefix, command) => {
    try {
      if (!args.length) {
        return m.reply('《✧》Especifica el nombre del paquete de stickers.')
      }
      const packName = args.join(' ').trim()
      const db = global.db.data
      if (!db.stickerspack) db.stickerspack = {}
      const packs = db.stickerspack[m.sender]?.packs || []
      if (!packs || packs.length === 0) {
        return m.reply('《✧》No tienes paquetes creados.')
      }
      const packIndex = packs.findIndex(p => p.name.toLowerCase() === packName.toLowerCase())
      if (packIndex === -1) {
        return m.reply(`《✧》No se encontró el paquete de stickers \`${packName}\`.`)
      }
      const deletedPack = packs[packIndex]
      packs.splice(packIndex, 1)
      db.stickerspack[m.sender].packs = packs
      m.reply(`❀ El paquete de stickers \`${deletedPack.name}\` ha sido eliminado.`)
    } catch (e) {
      m.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*. Please try again or contact support if the issue persists.\n> [Error: *${e.message}*]`)
    }
  }
}
