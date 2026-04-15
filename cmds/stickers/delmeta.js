export default {
  command: ['delmeta', 'delstickermeta'],
  category: 'stickers',
  run: async (client, m, args, usedPrefix, command) => {
    try {
      const db = global.db.data
      const userData = db.users[m.sender] || {}
      if ((!userData.metadatos || userData.metadatos === '') && (!userData.metadatos2 || userData.metadatos2 === '')) {
        return m.reply('《✧》No tienes metadatos asignados.')
      }
      db.users[m.sender].metadatos = ''
      db.users[m.sender].metadatos2 = ''
      await client.sendMessage(m.chat, { text: `✎ Los metadatos de tus stickers se han eliminado correctamente.` }, { quoted: m })
    } catch (e) {
      await m.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*. Please try again or contact support if the issue persists.\n> [Error: *${e.message}*]`)
    }
  }
}
