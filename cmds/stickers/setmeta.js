export default {
  command: ['setstickermeta', 'setmeta'],
  category: 'stickers',
  run: async (client, m, args, usedPrefix, command) => {
    if (!args || args.length === 0) {
      return m.reply('《✧》 Por favor, ingresa los metadatos que deseas asignar a tus stickers.')
    }
    try {
      const fullArgs = args.join(' ')
      const separatorIndex = fullArgs.search(/[|•\/]/)
      let metadatos01, metadatos02
      if (separatorIndex === -1) {
        metadatos01 = fullArgs.trim()
        metadatos02 = ''
      } else {
        metadatos01 = fullArgs.slice(0, separatorIndex).trim()
        metadatos02 = fullArgs.slice(separatorIndex + 1).trim()
      }
      if (!metadatos01) {
        return m.reply('《✧》 El nombre del pack no puede estar vacío.')
      }
      const db = global.db.data
      if (!db.users[m.sender]) db.users[m.sender] = {}
      db.users[m.sender].metadatos = metadatos01
      db.users[m.sender].metadatos2 = metadatos02
      await client.sendMessage(m.chat, { text: `✎ Los metadatos de tus stickers se han actualizado correctamente.` }, { quoted: m })
    } catch (e) {
      await m.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*. Please try again or contact support if the issue persists.\n> [Error: *${e.message}*]`)
    }
  }
}
