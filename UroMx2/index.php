<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>Estudio Urodinámico - Uroflujometría Digital Avanzada</title>
    <link rel="stylesheet" href="style.css">
    
    <!-- ORDEN DE CARGA CRÍTICO BLINDADO -->
    <script src="chart.js"></script>
    <script src="hammer.js"></script>
    <script src="chartjs-plugin-zoom.js"></script>
    <script src="chartjs-plugin-annotation.min.js"></script>
</head><body>
    <div class="app-container">
       
        <!-- Panel Lateral Izquierdo: Control de Series -->
        <aside class="sidebar">
            <h2 id="lbl-sidebar-titulo">MICCIÓN</h2>

            <div class="panel-acciones" style="width: 100%; box-sizing: border-box;">

        <button id="btn-abrir-drawer" class="btn-clinico" onclick="abrirDrawerFiltros(event)" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background-color: #34495e; font-size: 1.1rem;" title="Configuración de Filtros">⚙️</button>
	</div>
	<div id="Cafeteria" class="Cafeteria" style="position: relative; align-items: center; gap: 0px; padding: 0px"></div>
<!-- NUEVO ELEMENTO: Contenedor Flotante Clínico para Horas Hijas -->
<div id="KinderContenedor" style="display: none; position: absolute; width: 220px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 100; padding: 0px; **touch-action: manipulation;**">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0px; border-bottom: 15px solid #f1f5f9; padding-bottom: 0px;">
        <span id="flotante-titulo" style="font-size: 0.7rem; font-weight: bold; color: #334155;">Estudios</span>
        <button id="btn-cerrar-flotante" style="background: none; border: none; font-size: 0.9rem; cursor: pointer; color: #94a3b8; line-height: 1;">&times;</button>
    </div>
    <!-- Grilla elástica: se empacan en varias columnas automáticamente, sin márgenes ni espacios -->
    <div id="flotante-lista-contenido" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); gap: 0px; max-height: 140px; overflow-y: auto;"></div>
</div>                
        </aside>
        <!-- Panel Central: Gráfica y Métricas por Pestañas -->
        <main class="main-content" id="main-content-split">
            
            <!-- Panel Superior (Gráfica) -->
            <section class="chart-section">
                <button id="btn-salir-modo" style="display: none;" onclick="regresarGraficaOriginal()">← Salir de modo histórico</button>
                <div class="chart-wrapper">
                    <canvas id="GraficoMiccionCanvas"></canvas>
                </div>
                <div id="modal-paciente" class="panel-paciente-educativo"></div>
			</section>
            <!-- NUEVO COMPONENTE: Barra Divisoria Interactiva (Splitter) -->
            <div id="uro-splitter" class="grid-splitter"></div>
           
            <!-- Monitor Paramétrico Categorizado -->
<section class="calculos-section">
    <!-- Nuevo contenedor para alinear el título e información en el mismo renglón -->
    <div class="calculos-header">
        <h3 id="titulo-calculos">MÉTRICAS URODINÁMICAS</h3>
        <button class="btnAnalisisClinico" onclick="AnalisisClinico(event)">ℹ️</button>
    </div>
   
    <div style="position: relative; flex: 1;">
        <div id="BotonClinicoContenedor" class="BotonClinicoGrid"></div>
    </div>
</section>


        </main>

        <!-- Área Superpuesta Lateral: Explicación de Conceptos -->
        

    </div>

    <script src="app.js?v=1.0.4"></script>

<!-- =========================================================================
   BLOQUE FIJO E INAMOVIBLE: CONTENEDOR MAESTRO DRAWER FILTROS
   ========================================================================= -->
<div id="uro-drawer" class="drawer-filtros">
    <!-- BLOQUE FIJO E INAMOVIBLE: MANIJA ARRASTRABLE SUPERIOR -->
    <div id="uro-drawer-handle" class="drawer-header">
        <span>CONFIGURACIÓN DE FILTROS CLÍNICOS</span>
        <button id="btn-cerrar-drawer" class="btn-close-drawer">×</button>
    </div>
    
    <div class="drawer-body">
        <!-- SECCIÓN 1. SECCIÓN SELECCIÓN DE MODO -->
        <div class="selector-modo-container">
            <button id="btn-filtro-micciones" class="btn-modo-toggle active">MICCIONES</button>
            <button id="btn-filtro-dilataciones" class="btn-modo-toggle">DILATACIONES</button>
        </div>

        <!-- SECCIÓN 2: CALENDARIOS MANUALES CON ENLACES DE ETIQUETA NATIVOS -->
        <div class="bloque-rangos-manuales">
            <div class="rango-row-header">
                <!-- El atributo for simula de forma física y nativa el clic sobre el input al tocar el emoji -->
                <span class="col-header-dr">DESDE <label for="native-date-desde" class="btn-icon-calendario-label" title="Abrir Calendario">📅</label></span>
                <span class="col-header-dr">HASTA <label for="native-date-hasta" class="btn-icon-calendario-label" title="Abrir Calendario">📅</label></span>
            </div>
            
            <div class="rango-inputs-grid">
                <label>Fecha:</label>
                <input type="text" id="txt-fecha-desde" placeholder="dd/mm/yy" class="input-txt-clinico">
                <input type="text" id="txt-fecha-hasta" placeholder="dd/mm/yy" class="input-txt-clinico">
                
                <label>Hora:</label>
                <input type="text" id="txt-hora-desde" placeholder="HH:MM" class="input-txt-clinico">
                <input type="text" id="txt-hora-hasta" placeholder="HH:MM" class="input-txt-clinico">
            </div>

            <!-- Inputs nativos con opacidad cero para mantener el rastro físico activo en el celular -->
            <input type="date" id="native-date-desde" class="input-nativo-control-movil">
            <input type="date" id="native-date-hasta" class="input-nativo-control-movil">
        </div>


            <!-- Mecanismo de control nativo puro para el resguardo de fechas -->
            <input type="date" id="native-date-desde" style="position: absolute; opacity: 0; width: 0; height: 0; pointer-events: none;">
            <input type="date" id="native-date-hasta" style="position: absolute; opacity: 0; width: 0; height: 0; pointer-events: none;">
        </div>

        <!-- SECCIÓN 3. SECCIÓN BOTONES DÍAS RANGOS DE TIEMPO RÁPIDOS -->
        <div class="titulo-seccion-dr"></div>
        <div class="grid-botones-rapidos">
            <button class="btn-tiempo-rapido" data-dias="0">Hoy</button>
            <button class="btn-tiempo-rapido" data-dias="3">3 Días</button>
            <button class="btn-tiempo-rapido" data-dias="7">7 Días</button>
            <button class="btn-tiempo-rapido" data-dias="15">15 Días</button>
            <button class="btn-tiempo-rapido" data-dias="30">30 Días</button>
            <button class="btn-tiempo-rapido" data-dias="365">Historial</button>
        </div>

        <!-- SECCIÓN 4. SECCIÓN BOTONES HORAS BLOQUES HORARIOS DE ANÁLISIS-->
        <div class="titulo-seccion-dr"></div>
        <div class="grid-bloques-horas">
            <button class="btn-horas-bloque active" data-bloque="02-06">02 a 06</button>
            <button class="btn-horas-bloque active" data-bloque="06-10">06 a 10</button>
            <button class="btn-horas-bloque active" data-bloque="10-14">10 a 14</button>
            <button class="btn-horas-bloque active" data-bloque="14-18">14 a 18</button>
            <button class="btn-horas-bloque active" data-bloque="18-22">18 a 22</button>
            <button class="btn-horas-bloque active" data-bloque="22-02">22 a 02</button>
        </div>

        <!-- SECCIÓN 5. SECCIÓN BOTONERA ACCIONES -->
        <div class="fila-acciones-drawer">
            <button id="btn-drawer-limpiar" class="btn-accion-dr">Limpiar</button>
            <button id="btn-drawer-invertir" class="btn-accion-dr">Invertir</button>
            <button id="btn-drawer-aplicar" class="btn-accion-dr btn-master-aplicar">APLICAR FILTRO</button>
        </div>
    </div>
</div>
<!-- ========================================================================= -->

</body>
</html>