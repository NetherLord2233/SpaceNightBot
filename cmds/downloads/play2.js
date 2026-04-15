import yts from 'yt-search'
import axios from 'axios'
import fs from 'fs'
import { exec } from 'child_process'
import fetch from 'node-fetch'
import { getBuffer } from '../../core/message.js'

const isYTUrl = (url) => /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(url)

async function getVideoInfo(query, videoMatch) {
  const search = await yts(query)
  if (!search.all.length) return null
  const videoInfo = videoMatch ? search.videos.find(v => v.videoId === videoMatch[1]) || search.all[0] : search.all[0]
  return videoInfo || null
}

function convertToWhatsAppFormat(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    // scale y crop aseguran que la resolución sea par y máximo 480p
    const command = `ffmpeg -i "${inputPath}" -c:v libx264 -c:a aac -preset superfast -crf 28 -b:a 128k -vf "scale='min(854,iw)':'min(480,ih)':force_original_aspect_ratio=decrease,crop=trunc(iw/2)*2:trunc(ih/2)*2" -y "${outputPath}"`
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error("Error en FFmpeg:", error)
        return reject(error)
      }
      resolve()
    })
  })
}

export default {
  command: ['play2', 'mp4', 'ytmp4', 'ytvideo', 'playvideo'],
  category: 'downloader',
  run: async (client, m, args, usedPrefix, command) => {
    let tempInput = `./tmp_in_${Date.now()}.mp4`
    let tempOutput = `./tmp_out_${Date.now()}.mp4`

    try {
      if (!args[0]) {
        return m.reply('《✧》Por favor, menciona el nombre o URL del video que deseas descargar')
      }
      
      const text = args.join(' ')
      const videoMatch = text.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/))([a-zA-Z0-9_-]{11})/)
      const query = videoMatch ? 'https://youtu.be/' + videoMatch[1] : text
      let url = query, title = null, thumbBuffer = null

      try {
        const videoInfo = await getVideoInfo(query, videoMatch)
        if (videoInfo) {
          url = videoInfo.url
          title = videoInfo.title
          thumbBuffer = await getBuffer(videoInfo.image)
          
          const infoMessage = `➩ Descargando › *${title}*

> ❖ Canal › *${videoInfo.author?.name || 'Desconocido'}*
> ⴵ Duración › *${videoInfo.timestamp || 'Desconocido'}*
> ❀ Vistas › *${(videoInfo.views || 0).toLocaleString()}*
> ✩ Publicado › *${videoInfo.ago || 'Desconocido'}*
> ❒ Enlace › *${url}*`

          await client.sendMessage(m.chat, { image: thumbBuffer, caption: infoMessage }, { quoted: m })
        }
      } catch (err) {
        console.error("Error al obtener info del video:", err)
      }

      const video = await getVideoFromEvoGB(url)
      
      if (!video?.url) {
        return m.reply('❌ No se pudo obtener el enlace de la API. Intenta más tarde.')
      }

      await m.reply('⏳ *Paso 1:* Descargando video del servidor...')

      const response = await axios({
        method: 'get',
        url: video.url,
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Referer': 'https://api.evogb.org/'
        }
      })

      const rawBuffer = Buffer.from(response.data)

      if (rawBuffer.length < 100000) {
        return m.reply('❌ Error: El archivo descargado está vacío o bloqueado.')
      }

      fs.writeFileSync(tempInput, rawBuffer)

      await m.reply('⏳ *Paso 2:* Adaptando formato para WhatsApp (esto puede demorar unos segundos)...')

      await convertToWhatsAppFormat(tempInput, tempOutput)

      // Verificamos cuánto pesa el video final convertido
      const stats = fs.statSync(tempOutput)
      const fileSizeMB = stats.size / (1024 * 1024)

      if (fileSizeMB > 50) {
        return m.reply(`❌ El video resultante pesa demasiado (${fileSizeMB.toFixed(2)} MB). WhatsApp solo permite hasta 50MB.`)
      }

      await m.reply('✅ *Paso 3:* Conversión exitosa. Subiendo video al chat...')

      // 🔥 ENVIAMOS USANDO STREAM DIRECTO DESDE EL DISCO (Evita crash de memoria RAM)
      await client.sendMessage(m.chat, { 
        video: { stream: fs.createReadStream(tempOutput) }, 
        mimetype: 'video/mp4',
        fileName: `${title || 'video'}.mp4`,
        caption: `> 🎥 *${title || 'Video'}*`
      }, { quoted: m })

    } catch (e) {
      console.error(e)
      await m.reply(`> ❌ Ocurrió un error en el proceso: *${e.message}*`)
    } finally {
      // Limpiamos los archivos temporales
      if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput)
      if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput)
    }
  }
}

async function getVideoFromEvoGB(url) {
  try {
    const endpoint = `https://api.evogb.org/dl/ytmp4?url=${encodeURIComponent(url)}&quality=480&key=Alba070503`
    const res = await fetch(endpoint).then(r => r.json())
    if (res.status && res.data?.dl) {
      return { url: res.data.dl }
    }
  } catch (e) {
    console.log("Error en API EvoGB:", e.message)
  }
  return null
}
