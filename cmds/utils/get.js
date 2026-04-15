import fetch from 'node-fetch'
import { format } from 'util'

export default {
  command: ['get', 'fetch'],
  category: 'utils',
  run: async (client, m, args, usedPrefix, command) => {
    const text = args[0];
    if (!text) return m.reply('《✧》 Ingresa un enlace para realizar la solicitud.')
    if (!/^https?:\/\//.test(text)) {
      return m.reply('《✧》 Ingresa un enlace válido que comience con http o https');
    }
    try {
      const _url = new URL(text);
      const params = new URLSearchParams(_url.searchParams);
      const url = `${_url.origin}${_url.pathname}${params.toString() ? '?' + params.toString() : ''}`;
      
      const res = await fetch(url);
      
      // Obtenemos el tipo exacto del archivo desde la web
      const contentType = res.headers.get('content-type') || 'application/octet-stream';
      const contentLength = parseInt(res.headers.get('content-length') || '0');

      if (contentLength > 100 * 1024 * 1024) {
        return m.reply(`《✧》 El archivo es demasiado grande.\nContent-Length: ${contentLength} bytes`);
      }
      
      if (/text|json/.test(contentType)) {
        const buffer = await res.buffer();
        try {
          const json = JSON.parse(buffer.toString());
          return m.reply(format(json).slice(0, 65536));
        } catch {
          return m.reply(buffer.toString().slice(0, 65536));
        }
      } else {
        const buffer = await res.buffer();
        
        // 🔥 SOLUCIÓN: Usamos client.sendMessage nativo.
        // Organizamos el envío dependiendo de lo que responda el servidor.
        let messageOptions = { mimetype: contentType, fileName: 'archivo' };
        
        if (contentType.includes('image')) {
          messageOptions.image = buffer;
          messageOptions.caption = text;
        } else if (contentType.includes('video')) {
          messageOptions.video = buffer;
          messageOptions.caption = text;
        } else if (contentType.includes('audio')) {
          messageOptions.audio = buffer;
        } else {
          // Si no es imagen, ni video, ni audio, lo manda como documento
          messageOptions.document = buffer;
          messageOptions.caption = text;
        }

        // Enviamos sin usar sendFile para evitar el crasheo
        return client.sendMessage(m.chat, messageOptions, { quoted: m });
      }
    } catch (e) {
      console.error(e); // Corregido el nombre de la variable de error
      return m.reply(`> Ocurrió un error inesperado al ejecutar el comando *${usedPrefix + command}*.\n> [Error: *${e.message}*]`)
    }
  }
};
