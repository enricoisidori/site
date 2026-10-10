// A classic script also runs when this document is opened from Finder (file://).
// Do not construct workers or request archive APIs from that unsupported origin.
if (location.protocol === 'file:') {
  const status = document.querySelector('#status');
  status.replaceChildren();
  status.append('Spiral richiede il server locale. Avvia “Avvia Spiral.command” nella stessa cartella, oppure esegui: ');
  const command = document.createElement('code');
  command.textContent = 'python3 server.py --open';
  const link = document.createElement('a');
  link.href = `http://127.0.0.1:8080/${document.body.dataset.mode === 'commons' ? 'commons.html' : ''}`;
  link.textContent = 'Apri Spiral se il server è già avviato →';
  status.append(command, document.createElement('br'), link);
} else {
  import(document.body.dataset.mode === 'commons' ? './commons.js' : './app.js').catch(error => {
    console.error('[spiral] App loading failed', error);
    const status = document.querySelector('#status');
    status.hidden = false;
    status.textContent = 'Impossibile caricare Spiral. Verifica la connessione e che tutti i file siano stati pubblicati, poi ricarica.';
  });
}
