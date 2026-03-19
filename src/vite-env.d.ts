/// <reference types="vite/client" />

// Import de fichiers quelconques comme texte brut via ?raw
declare module '*?raw' {
  const content: string;
  export default content;
}
