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

// 🔥 FUNCIÓN FFMPEG: Convierte cualquier video rebelde al formato sagrado de WhatsApp
function convertToWhatsAppFormat(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    // scale=... achica el video a 480p máximo. 
    // crop=... fuerza a que los píxeles sean números PARES cortando 1px si es necesario (soluciona el error de libx264)
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

      // 1. Obtener información y enviar el mensaje con el formato ORIGINAL de tu bot
      try {
        const videoInfo = await getVideoInfo(query, videoMatch)
        if (videoInfo) {
          url = videoInfo.url
          title = videoInfo.title
          thumbBuffer = await getBuffer(videoInfo.image)
          const vistas = (videoInfo.views || 0).toLocaleString()
          const canal = videoInfo.author?.name || 'Desconocido'

          const infoMessage = `➩ Descargando › *${title}*

> ❖ Canal › *${canal}*
> ⴵ Duración › *${videoInfo.timestamp || 'Desconocido'}*
> ❀ Vistas › *${vistas}*
> ✩ Publicado › *${videoInfo.ago || 'Desconocido'}*
> ❒ Enlace › *${url}*`

          await client.sendMessage(m.chat, { image: thumbBuffer, caption: infoMessage }, { quoted: m })
        }
      } catch (err) {
        console.error("Error al obtener info del video:", err)
      }

      // 2. Obtener el link de descarga usando la API de EvoGB
      const video = await getVideoFromEvoGB(url)
      
      if (!video?.url) {
        return m.reply('《✧》 No se pudo obtener el enlace de descarga de EvoGB. Intenta más tarde.')
      }

      await m.reply('⏳ Procesando y adaptando el video para WhatsApp (FFmpeg)...')

      // 3. Descargamos el video bruto con Axios simulando ser Chrome
      const response = await axios({
        method: 'get',
        url: video.url,
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://api.evogb.org/'
        }
      })

      const rawBuffer = Buffer.from(response.data)

      // Verificamos que EvoGB no nos haya mandado una página de error
      const checkContent = rawBuffer.toString('utf-8', 0, 100).toLowerCase()
      if (checkContent.includes('<!doctype html>') || checkContent.includes('<html')) {
         return m.reply('❌ EvoGB bloqueó la descarga temporalmente.')
      }
      if (rawBuffer.length < 100000) {
        return m.reply('❌ El archivo descargado está dañado o vacío.')
      }

      // 4. Guardamos el video bruto
      fs.writeFileSync(tempInput, rawBuffer)

      // 5. Lo pasamos por la "licuadora" de FFmpeg
      await convertToWhatsAppFormat(tempInput, tempOutput)

      // 6. Leemos el video convertido y 100% compatible
      const finalVideoBuffer = fs.readFileSync(tempOutput)

      // 7. Lo enviamos como video normal a WhatsApp
      await client.sendMessage(m.chat, { 
        video: finalVideoBuffer, 
        mimetype: 'video/mp4',
        fileName: `${title || 'video'}.mp4`,
        caption: `> 🎥 *${title || 'Video'}*`
      }, { quoted: m })

    } catch (e) {
      console.error(e)
      await m.reply(`> Error al procesar el video: *${e.message}*\n> (Verifica que tu hosting tenga FFmpeg instalado)`)
    } finally {
      // 8. Limpieza obligatoria para que tu servidor no se llene de videos
      if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput)
      if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput)
    }
  }
}

// 🔥 API EXCLUSIVA: EvoGB (Endpoint ytmp4)
async function getVideoFromEvoGB(url) {
  try {
    const endpoint = `https://api.evogb.org/dl/ytmp4?url=${encodeURIComponent(url)}&quality=480&key=Alba070503`
    const res = await fetch(endpoint).then(r => r.json())
    
    // Extractor basado en la documentación de EvoGB (data.dl)
    if (res.status && res.data?.dl) {
      return { url: res.data.dl }
    }
  } catch (e) {
    console.log("Error en API EvoGB:", e.message)
  }
  return null
}
