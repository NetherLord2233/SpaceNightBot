import fetch from "node-fetch"
import yts from "yt-search"
import axios from "axios"

function formatViews(views) {
  try {
    return views >= 1000
      ? `${(views / 1000).toFixed(1)}k (${views.toLocaleString()})`
      : views.toString()
  } catch {
    return "0"
  }
}

export default {
  command: ['play', 'play2', 'mp3', 'yta', 'mp4', 'ytv'],
  category: 'downloader',

  run: async (client, m, args, command) => {
    try {
      if (!args.length) {
        return m.reply('✎ Ingresa el nombre de la música o video.')
      }

      let text = args.join(" ")

      // 🔍 BUSCAR VIDEO
      let search = await yts(text)
      if (!search.all?.length) return m.reply('❌ No se encontraron resultados.')

      let video = search.videos[0]
      let { title, thumbnail, timestamp, views, ago, url } = video

      let vistaTexto = formatViews(views)

      // 📸 INFO BONITA
      let mensaje = `┌──⊰🎵 YOUTUBE ⊱──
│✍️ Título: ${title}
│📆 Publicado: ${ago}
│🕟 Duración: ${timestamp}
│👁️ Visitas: ${vistaTexto}
└──────────────`

      await client.sendMessage(m.chat, {
        image: { url: thumbnail },
        caption: mensaje
      }, { quoted: m })

      await m.reply('⏳ Descargando...')

      // ================= AUDIO =================
      if (['play', 'yta', 'mp3'].includes(command)) {

        let dl = null

        // 🔥 API 1 (EVOGB)
        try {
          let res = await fetch(`https://api.evogb.org/dl/ytmp3?url=${encodeURIComponent(url)}&key=Alba070503`)
          let json = await res.json()
          dl = json?.data?.dl
        } catch {}

        // 🔥 API 2 (FALLBACK)
        if (!dl) {
          try {
            let res = await axios.get(`https://api.zenzxz.my.id/download/youtube?url=${encodeURIComponent(url)}&format=mp3`)
            dl = res?.data?.result?.download
          } catch {}
        }

        if (!dl) return m.reply('❌ No se pudo descargar el audio')

        await client.sendMessage(m.chat, {
          audio: { url: dl },
          mimetype: "audio/mpeg",
          fileName: `${title}.mp3`
        }, { quoted: m })
      }

      // ================= VIDEO =================
      else if (['play2', 'ytv', 'mp4'].includes(command)) {

        let dl = null

        try {
          let res = await fetch(`https://api.evogb.org/dl/ytmp4?url=${encodeURIComponent(url)}&quality=480&key=Alba070503`)
          let json = await res.json()
          dl = json?.data?.dl
        } catch {}

        if (!dl) return m.reply('❌ No se pudo descargar el video')

        await client.sendMessage(m.chat, {
          video: { url: dl },
          mimetype: "video/mp4",
          caption: `🎬 ${title}`
        }, { quoted: m })
      }

      else {
        m.reply('❌ Comando no válido')
      }

    } catch (e) {
      console.error(e)
      m.reply(`❌ Error:\n${e.message}`)
    }
  }
}
