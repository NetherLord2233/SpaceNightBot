import axios from 'axios'

export default {
  command: ['gelbooru', 'gbooru'],
  category: 'nsfw',
  run: async (client, m, args, usedPrefix, command) => {
    try {
      if (!global.db.data.chats[m.chat]?.nsfw) return m.reply(`ꕥ El contenido *NSFW* está desactivado en este grupo.\n\nUn *administrador* puede activarlo con el comando:\n» *${usedPrefix}nsfw on*`)
      if (!args[0]) return client.reply(m.chat, `《✧》 Debes especificar tags para buscar\n> Ejemplo » *${usedPrefix + command} neko*`, m)
      await m.react('🕒')
      const tag = args.join(' ').replace(/\s+/g, '_')
      const url = `https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(tag)}&api_key=f965be362e70972902e69652a472b8b2df2c5d876cee2dc9aebc7d5935d128db98e9f30ea4f1a7d497e762f8a82f132da65bc4e56b6add0f6283eb9b16974a1a&user_id=1862243`
      const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Referer': 'https://gelbooru.com/', 'Accept': 'application/json' } })
      const data = res.data?.post || []
      if (!data.length) return client.reply(m.chat, `《✧》 No se encontraron resultados para ${tag}`, m)
      const shuffled = data.sort(() => Math.random() - 0.5)
      let sent = false
      for (const post of shuffled) {
        const fileUrl = post.file_url || post.sample_url
        if (!fileUrl || !/\.(jpe?g|png|gif|mp4)(\?.*)?$/i.test(fileUrl)) continue
        try {
          const imgRes = await axios.get(fileUrl, { responseType: 'arraybuffer', headers: { 'Referer': 'https://gelbooru.com/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }, timeout: 15000 })
          const buffer = Buffer.from(imgRes.data)
          const isVideo = /\.mp4(\?.*)?$/i.test(fileUrl)
          const caption = `ꕥ Resultados para » ${tag}`
          if (isVideo) {
            await client.sendMessage(m.chat, { video: buffer, caption, mentions: [m.sender] })
          } else {
            await client.sendMessage(m.chat, { image: buffer, caption, mentions: [m.sender] })
          }
          sent = true
          break
        } catch {}
      }
      if (!sent) return client.reply(m.chat, `《✧》 No se encontraron resultados para ${tag}`, m)
      await m.react('✔️')
    } catch (e) {
      await m.react('✖️')
      await m.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*. Please try again or contact support if the issue persists.\n> [Error: *${e.message}*]`)
    }
  }
}