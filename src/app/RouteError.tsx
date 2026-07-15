import { useRouteError } from 'react-router-dom'

/**
 * Fallback global de erro (auditoria P1.8). Ligado como `errorElement` na raiz
 * do router — captura erros de render/loader em qualquer tela e mostra uma
 * saída amigável em PT-BR em vez de uma tela branca.
 */
export function RouteError() {
  const error = useRouteError()
  if (import.meta.env.DEV) console.error('[Sabido] erro de rota:', error)

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-5xl">😵</span>
      <h1 className="text-xl font-bold text-gray-800">Algo deu errado</h1>
      <p className="text-sm text-gray-500">
        Tivemos um problema ao abrir esta tela. Seu progresso está salvo — é só tentar de novo.
      </p>
      <button className="btn-primary" onClick={() => (window.location.href = '/')}>
        Voltar ao início
      </button>
    </div>
  )
}
