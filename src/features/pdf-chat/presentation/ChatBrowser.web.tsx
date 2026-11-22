export default function ChatBrowser({ uri }: { uri: string }) {
  return <iframe title="Papyrus · Chat với PDF" src={uri}
    style={{ width: '100%', flex: 1, border: 0, minHeight: 560 }} />;
}
