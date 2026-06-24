<?php
header('Content-Type: application/json; charset=utf-8');

$filename = __DIR__ . '/CAUDAL.txt';

if (!file_exists($filename)) {
    echo json_encode(['error' => 'El archivo CAUDAL.txt no se encuentra en la raiz del servidor.']);
    exit;
}

$lineas = file($filename, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
$respuesta = [];

$fecha_anterior_rastreo = "";
$id_dia_contador = -1; 
$conteo_micciones_del_dia = 0;
$id_ContadorTotal =0;

// Rastreadores para formular idDilatacion
$ciclo_dilatacion_actual = -1; 
$conteo_micciones_dilatacion = 0;
$sonda_fr_anterior = 0;

// MAPEO CRONOLÓGICO SEGURO DE CICLOS ANTES DE INVERTIR LA LISTA
$mapa_ciclos_dilatacion = [];
$mapa_calibres_sonda = [];
$num_miccion = 0;
$contador_ciclos = 0;
$calibre_actual = 0;
$es_apertura_ciclo = [];

foreach ($lineas as $idx => $linea_original) {
    $datos_linea = explode(',', trim($linea_original));
    if (count($datos_linea) < 4) continue;
    
    $fecha_check = trim($datos_linea[0]);
    $apertura_detectada = 0;
    
    if (substr($fecha_check, 0, 1) === '@') {
        $partes_arroba = explode('@', $fecha_check);
        if (count($partes_arroba) >= 3) {
            $contador_ciclos++;
            $calibre_actual = intval($partes_arroba[1]);
            $apertura_detectada = 1;
        }
    }
    
    $mapa_ciclos_dilatacion[$idx] = $contador_ciclos;
    $mapa_calibres_sonda[$idx] = $calibre_actual;
    $es_apertura_ciclo[$idx] = $apertura_detectada;
}

$lineas_reversas = array_reverse($lineas, true);

foreach ($lineas_reversas as $idx_linea => $linea) {
    $datos = explode(',', trim($linea));
    if (count($datos) < 4) continue;

    $fecha_completa = trim($datos[0]); // "dd-mm-yyyy hh:mm:ss" o "@FR@dd-mm-yyyy hh:mm:ss"
    
    // LIMPIEZA ADAPTATIVA DE LA FECHA PARA TUS CÁLCULOS NATIVOS SUCESIVOS
    $sonda_fr_detectado = 0;
    $es_miccion_apertura = 0;
    
    if (substr($fecha_completa, 0, 1) === '@') {
        $partes_arroba = explode('@', $fecha_completa);
        if (count($partes_arroba) >= 3) {
            $fecha_completa = trim($partes_arroba[2]); // Aísla la fecha limpia "dd-mm-yyyy hh:mm:ss"
        }
    }
    
    $ciclo_asignado = isset($mapa_ciclos_dilatacion[$idx_linea]) ? $mapa_ciclos_dilatacion[$idx_linea] : 0;
    $sonda_fr_detectado = isset($mapa_calibres_sonda[$idx_linea]) ? $mapa_calibres_sonda[$idx_linea] : 0;
    $es_miccion_apertura = isset($es_apertura_ciclo[$idx_linea]) ? $es_apertura_ciclo[$idx_linea] : 0;

    // =========================================================================
    // MATRIZ DE PRECISIÓN CRONOLÓGICA SÍNCRO: PURIFICACIÓN DE FECHA Y FLOATS
    // =========================================================================
    // A) Rebanamos los segundos de la hora para fijar la cadena a 16 caracteres ("dd/mm/yyyy hh:mm")
    // Reemplazamos guiones por barras de forma nativa para estandarizar el indexado
    $fecha_estandarizada = str_replace('-', '/', $fecha_completa);
    $fecha_partes_espacio = explode(" ", $fecha_estandarizada);
    $fecha_pura_10 = $fecha_partes_espacio[0]; // Extrae "dd/mm/yyyy"
    $hora_corta_5 = isset($fecha_partes_espacio[1]) ? substr($fecha_partes_espacio[1], 0, 5) : "00:00"; // Extrae "hh:mm"
    $fecha_mix_final = $fecha_pura_10 . " " . $hora_corta_5;

    // B) Lógica Float idDia (Día.Micción consecutivo de Comadres)
    if ($fecha_pura_10 !== $fecha_anterior_rastreo) {
        $id_dia_contador++; 
        $conteo_micciones_del_dia = 0; // SOLUCIÓN: Arranca en .00 de forma nativa
        $fecha_anterior_rastreo = $fecha_pura_10;
    } else {
        $conteo_micciones_del_dia++;
    }
    $id_dia_float = floatval($id_dia_contador + ($conteo_micciones_del_dia / 100));

    // C) Lógica Float idDilatacion (Ciclo.Micción consecutivo de Sondas)
    if ($sonda_fr_detectado !== $sonda_fr_anterior) {
        $ciclo_dilatacion_actual++;
        $conteo_micciones_dilatacion = 0; // .000 es la micción de apertura del ciclo de sonda
        $sonda_fr_anterior = $sonda_fr_detectado;
    } else {
        $conteo_micciones_dilatacion++;
    }
    $id_dilatacion_float = floatval($ciclo_dilatacion_actual + ($conteo_micciones_dilatacion / 1000));
    
    // Identificador único requerido para la barra lateral: "dd-mm hh:mm"
    $id_miccion = (strlen($fecha_completa) >= 16) ? substr($fecha_completa, 0, 5) . ' ' . substr($fecha_completa, 11, 5) : $fecha_completa;
    
    $unidad_tiempo_ms = floatval(trim($datos[1]));
    $lecturas_efectivas = intval(trim($datos[2]));
    
    $secuencia_cruda = implode(',', array_slice($datos, 3));
    $incrementos_crudos = array_slice($datos, 3);
    
    // --- 1. TRAMA COMPLETA DE DIAGNÓSTICO (Para curvas visuales sin truncar) ---
    $incrementos_totales = [];
    foreach ($incrementos_crudos as $inc_crud) {
        $val = floatval(trim($inc_crud))/1000;
        // Se limpian ruidos espurios o lecturas por debajo de cero absoluto
        $incrementos_totales[] = ($val < 0) ? 0.0 : $val;
    }

    $tiempo_seg = [];
    $volumen_acumulado = [];
    $flujo_mls = [];
	$flujo_mls2 = [];
    $vol_acumulado_temp = 0;
    $dt_seg = $unidad_tiempo_ms / 1000.0;

    foreach ($incrementos_totales as $index => $inc_vol) {
        $t_actual = $index * $dt_seg;
        $vol_acumulado_temp += $inc_vol;
        $flujo_inst = ($dt_seg > 0) ? ($inc_vol / $dt_seg) : 0;

        $tiempo_seg[] = round($t_actual, 3);
        $volumen_acumulado[] = round($vol_acumulado_temp, 3);
    	$flujo_mls[] = intval($flujo_inst * 1000) ;
    	$flujo_mls2[] = $inc_vol * 1000;
    }

    if (empty($tiempo_seg)) continue;

	// --CONVERSION DE LECTURAS A RESOLUCIÓN FIJA
	$nvo_dt = 0.100;     // Nueva resolución (ej. cada 100 mssegundo)
	$K = $nvo_dt / $dt_seg;

	// 2. Calcular cuántas lecturas tendrá el nuevo arreglo
	$total_original = count($incrementos_totales);
	$total_nuevo = floor($total_original / $K);
	$incremento_nuevo = [];

	// 3. Mapear los índices usando redondeo
	for ($i = 0; $i < $total_nuevo; $i++) {
    	// Calculamos qué índice original corresponde y lo redondeamos al entero más cercano
	    $indice_original = round($i * $K);
	    // Nos aseguramos de no pasarnos del límite del arreglo original
	    if ($indice_original >= $total_original) {
    	    $indice_original = $total_original - 1;
	    }
    	// Guardamos el valor en el nuevo arreglo
	    //$incremento_nuevo[] = number_format($incrementos_totales[$indice_original]*10, 3, '.', '');
    	$incremento_nuevo[] = $incrementos_totales[$indice_original]*10;
	}

	// --- 2. SUB-TRAMA DE CONTROL CLÍNICO (Truncada al conteo de lecturas efectivas) ---
    $incrementos_calculo = array_slice($incrementos_totales, 0, $lecturas_efectivas);    
    $tiempo_seg_calc = [];
    $volumen_acumulado_calc = [];
    $flujo_mls_calc = [];
    $vol_calc_temp = 0;

    foreach ($incrementos_calculo as $index => $inc_vol) {
        $t_actual = $index * $dt_seg;
        $vol_calc_temp += $inc_vol;
        $flujo_inst = ($dt_seg > 0) ? ($inc_vol / $dt_seg) : 0;

        $tiempo_seg_calc[] = $t_actual;
        $volumen_acumulado_calc[] = $vol_calc_temp;
        $flujo_mls_calc[] = $flujo_inst;
    }

    // --- 3. PROCESAMIENTO MÉDICO DE TIEMPOS, VOLÚMENES Y VELOCIDADES DE FLUJO ---
    $Vflow = end($volumen_acumulado_calc); // Volumen efectivo dentro de la ventana efectiva
    $Qmax = count($flujo_mls_calc) > 0 ? max($flujo_mls_calc) : 0;
    
    // CORRECCIÓN TQMAX: Tiempo exacto al flujo máximo en segundos
    $idx_Qmax = array_search($Qmax, $flujo_mls_calc);
    $tQmax = ($idx_Qmax !== false) ? ($idx_Qmax + 1) * $dt_seg : 0;
    
    // CORRECCIÓN TVOID: Tiempo de micción total más un ciclo de discretización
    $tvoid = (count($incrementos_totales)) * $dt_seg; 

    // CORRECCIÓN TFLOW: Tiempo neto de flujo continuo en la ventana activa (Umbral >= 0.1 mL/s)
    $lecturas_con_flujo = 0;
    foreach ($flujo_mls_calc as $f) {
        if ($f >= 0.1) $lecturas_con_flujo++;
    }
    $tflow = $lecturas_con_flujo * $dt_seg;
    
    // Flujo promedio real calculado sobre el tiempo neto de vaciado activo
    $Qave = ($tflow > 0) ? ($Vflow / $tflow) : 0;

    // CORRECCIÓN VFLOW: Volumen efectivo de flujo basándose en el corte ICS (>= 0.1 mL/s)
    $Vflow = 0;
    foreach ($incrementos_calculo as $idx => $inc) {
        if (isset($flujo_mls_calc[$idx]) && $flujo_mls_calc[$idx] >= 0.1) $Vflow += $inc;
    }

    // Tiempos fraccionarios de vaciado funcional
    $t10 = 0; $t95 = 0;
    foreach ($volumen_acumulado_calc as $idx => $vol) {
        if ($t10 == 0 && $vol >= ($Vflow * 0.10)) $t10 = $tiempo_seg_calc[$idx];
        if ($t95 == 0 && $vol >= ($Vflow * 0.95)) $t95 = $tiempo_seg_calc[$idx];
    }

    // Velocidad de flujo a los 2 segundos del inicio
    $q2 = 0;
    foreach ($tiempo_seg_calc as $idx => $t) {
        if ($t >= 2.0) { $q2 = $flujo_mls_calc[$idx]; break; }
    }

    // Máxima 
    //  de incremento o pendiente de aceleración del chorro urinario
    $SRmax = 0;
    for ($i = 1; $i < count($flujo_mls_calc); $i++) {
        $diff_f = $flujo_mls_calc[$i] - $flujo_mls_calc[$i-1];
        $sr = $diff_f / $dt_seg;
        if ($sr > $SRmax) $SRmax = $sr;
    }

    // Aceleración de apertura del cuello vesical (
    $acel_apertura = ($tQmax > 0) ? ($Qmax / $tQmax) : 0;

    // --- 4. EXTRACCIÓN DE LA FASE DE GOTEO TERMINAL SIGNIFICATIVO ---
    $incrementos_goteo = array_slice($incrementos_totales, $lecturas_efectivas);
    
    // Filtro de ruido para goteo acumula solo valores positivos reales
    $Vdrop = 0;
    foreach ($incrementos_goteo as $inc_g) {
        if ($inc_g > 0) $Vdrop += $inc_g;
    }
    
    $goteo_tiempo = count($incrementos_goteo) * $dt_seg;
    $Qdrop = ($goteo_tiempo > 0) ? ($Vdrop / $goteo_tiempo) : 0;
    $Vvoid = $Vflow + $Vdrop;

    // Tasa de deceleración clínica (caída desde Qmax hasta el cierre del flujo efectivo)
    $t_desf = (end($tiempo_seg_calc)) - $tQmax;
    $Tdesa = ($t_desf > 0) ? ($Qmax / $t_desf) : 0;

    // =========================================================================
    // 5. CORRECCIÓN MAESTRA: CÁLCULOS AVANZADOS CON TUS VARIABLES REALES DEL JSON
    // =========================================================================
    

    // Vexit: Velocidad de salida proporcional en escala urodinámica (m/s)
    $Vexit = 0.14147 * $Qmax;

    // remax: Número de Reynolds en escala lineal pura
    $DiamEfectivoEstenosis = ($Vexit > 0) ? (2 * sqrt($Qmax / pi() * $Vexit)) : 3;
	$DiamConducto = sqrt((4 * $Qmax / 1000000)/(pi()*$Vexit));
    $ViscosidadDinamica = 0.001;  // Pa
	$DensidadOrina = 1020;  // kg/m3
	$remax = $DensidadOrina * $Vexit * $DiamConducto / $ViscosidadDinamica;
	

    // f_darcy: Factor de fricción viscosa de Darcy-Weisbach
	$Constante = 0.3164;
    $f_darcy = ($remax > 0) ? ($Constante / pow($remax, 0.25)) : 0;

    // Efric: Energía perdida por fricción (J/Kg)
	/* Mide de manera exacta cuántos Joules de energía por cada kilogramo de orina se disipan en forma de calor y turbulencia debido a las restricciones del conducto.
     * Rango de	Clasificación Hidráulica	Diagnóstico Clínico Asociado
	<0.25	Pérdida Fisiológica Normal		Conducto sano y elástico. La energía se conserva para la proyección del chorro.
	<0.65	Pérdida Moderada / Compensada	Hiperplasia Prostática Benigna (HPB) leve o uretra envejecida.
	<=1.5	Pérdida Alta por Restricción	Típico de Estenosis Uretral Anatómica (como tu paciente). El tejido rígido destruye la energía disponible.
	>1.5	Pérdida Crítica / Disipación Máxima	Estenosis severísima o retención urinaria incompleta. Riesgo inminente de daño vesical.
	 */ 
    $Efric = $f_darcy * 150 / $DiamEfectivoEstenosis * pow($Vexit, 2) / 2;

	/* pot_dis: Potencia disipada uretral (mWatts)
     *representa el costo energético absoluto, expresado en Vatios (W), que el cuerpo paga debido a la fricción interna del fluido contra las paredes del conducto.
	Mientras que la Pérdida de Energía por Fricción que calculamos antes te da el dato unitario por cada kilogramo de orina, la Potencia de Pérdida te dice cuántos Joules de energía se destruyen por cada segundo que dura la micción, transformándose irreversiblemente en calor dentro de la uretra [URA] Disipación Crítica (Falla de Carga)	Pérdida masiva de potencia. El sistema opera bajo un estrés destructivo para las paredes uretrales.
    Rango  	Clasificación de Disipación		Impacto Clínico en el Tracto Urinario
    <1.5 	Disipación Mínima (Fisiológica)	Flujo limpio. Prácticamente toda la potencia de la vejiga se transmite al exterior.
	<5		Disipación Moderada				Común en obstrucciones elásticas (HPB inicial) o ligeras irregularidades mucosas.
	<=15	Disipación Obstructiva Alta		Caso de tu paciente. Firma hidrodinámica de una estenosis fija. El tejido rígido absorbe y destruye energía constantemente.
     */ 
    $pot_dis = $DensidadOrina * $Qmax * pow(10,-3) * $Efric;


    // linPURR: Índice de Obstrucción Linealizado (Purr)
    //@$linPURR = (40.0 - (2 * $Qmax)) / 10;
	/* el 64, 0.0075 es por tabla de edad, el 50 es el volumen de vejiga minimo para que no colapse. Solo viable cuando Vvoid >=150
 	 40 - 49	72.5	0.0080
	 50 - 59	64.0	0.0075
	 60 - 69 	57.0	0.0070 */

	$PdetQmax = 64*(1-exp(-0.0075*($Vvoid-50)));    //Presión del Detrusor en Flujo Máximo Es la presión real que ejerce el músculo de la vejiga en el instante preciso en que el flujo es el más alto (medido en cmH2O. Se obtiene restando la presión abdominal de la presión dentro de la vejiga
	$linPURR = $PdetQmax/(40+(2*$Qmax));  
	/*
	 Rango de linPURR	Grado de Schäfer	Clasificación Diagnóstica Clínica
	<0.50				Grado 0 - I			Normal / No Obstruido
	0.50<=OCO<1			Grado II			Zona Equívoca (Sospecha Leve)
    1<=OCO<1.5			Grado III			Obstrucción Moderada (Estenosis/HPB inicial)
	1.5<OCO<2			Grado IV			Obstrucción Severa
	<=2					Grado V - VI		Obstrucción Muy Severa */

    // BWI: Bladder Weight Index / Trabajo del detrusor
    //$BWI = ($Qmax > 0) ? (40.0 / sqrt($Qmax)) : 0;
	/*
	 * Rango de W80 [W/m2]	Estado Funcional de la Vejiga	Interpretación Clínica
	 * <2.0					Hipocontráctil Severo			Vejiga extremadamente débil o agotada.
	 * 2.0 - 3.5			Contracción Débil / Límite		Inicio de claudicación muscular (Fatiga vesical).
	 * 3.5 - 7.5			Contracción Normal / Eficiente	Fuerza muscular adecuada para vencer la resistencia.
	 * 7.5 - 12				Hipercontráctil / Esfuerzo Alto	La vejiga trabaja bajo un estrés masivo (Lucha).
	 * >12					Síndrome de Vejiga de Lucha		Riesgo inminente de daño estructural y divertículos.*/
	//$BWI (W estatico) + (W dinámico)= 
	$BWI = ($PdetQmax * $Qmax / 100) + (8.266 * 0.0001 * pow($Qmax, 3) / pow($DiamEfectivoEstenosis, 4));

    /* CVI: Contractility Index
     * Rango de 
    (%)		Clasificación Hidrodinámica		Significado Clínico y Diagnóstico
    <25%	Flujo Altamente Estable (Meseta)	Típico de Estenosis Uretral Fija. El chorro es lento pero constante, no fluctúa.
	25-45	Flujo Variable Normal	Curva en campana estándar de un paciente sano.
	45-70	Flujo Fluctuante / Inestable	Típico de Hiperplasia Prostática (HPB). El tejido elástico de la próstata hace que el chorro "tiemble".
	>70	Flujo Intermitente (Fraccionado)	Pujo Abdominal / Detrusor Intermitente. El paciente orina a pausas o por goteo severo.
     */ 
    $CVI = ($Qave > 0) ? ((($Qmax - $Qave) / 2 + ( 0.15 * $Qave )) / $Qave * 100) : 0;

    /* ECmax: Energía cinética máxima del chorro urinario
     * Rango mW	Clasificación Energética	Estado Clínico del Paciente
	<5.0		Energía Críticamente Baja	Típico de Estenosis Uretral Severa u obstrucciones fijas. El chorro no tiene fuerza de impacto.
    5-15		Energía Reducida / Moderada	Común en Hiperplasia Prostática (HPB) en desarrollo o adultos mayores sanos.
    15-40		Energía Normal				Rango estándar para un hombre adulto joven sano. Chorro con excelente empuje.
    >40			Hiperenergía				Flujo en jóvenes deportistas o pacientes con vejigas hiperactivas inestables.
     
    $ECmax = $DensidadOrina / 2 * pow($Vexit, 2) * ($Qmax / 1000);*/

    /* Ptot: Presión total hidrodinámica estimada en Ns (Kg m/s)
     El Momentum Lineal Total Vesical —también conocido como cantidad de movimiento del chorro urinario— es el parámetro físico que mide la fuerza de empuje acumulada e integrada a lo largo del tiempo que el fluido ejerce al ser expulsado [URA].
	A diferencia de la Energía Cinética Máxima (que toma una foto instantánea del peor momento de la obstrucción), el Momentum Lineal Total evalúa el impacto físico real de toda la micción completa de principio a fin, traduciendo la inercia del fluido en una variable clínica medible [URA].
     * Rango de Clasificación de Inercia			Significado Clínico Diagnóstico
	<0.1		Inercia Críticamente Baja			Típico de micciones por goteo o volúmenes insuficientes. Falla severa de vaciado.
	<0.2		Momentum Atenuado					Común en vejigas hipotónicas (débiles) que no logran acelerar la masa de orina.
	<=0.4		Momentum Prolongado de Resistencia	Caso de tu paciente. La masa total de la orina es normal, pero tarda mucho tiempo en salir a baja velocidad.
    >.4			Momentum Fisiológico Alto			Chorro con gran masa y alta velocidad. Vaciamiento óptimo e inmediato.
	*/
	$Ptot =    $DensidadOrina * $Vvoid * $Qave * 4 * pow(10, -3) / (pi() * pow($DiamEfectivoEstenosis,2));

    /* Pothyd: Potencia hidráulica de descarga (mW)
     * 	parámetro físico que mide la tasa neta de transferencia de energía del fluido en el momento exacto en que abandona el cuerpo [URA].
		Mientras que el índice W80 calcula la potencia total que genera el músculo de la vejiga adentro, la Potencia de Descarga calcula cuántos Vatios de esa potencia útil sobrevivieron a la fricción y lograron manifestarse en el chorro urinario exterior [URA]. Es el indicador definitivo de la eficiencia real de la micción.
        Rango  	Clasificación de Potencia		Diagnóstico de Eficiencia Vesical
        <5		Eficiencia Crítica (Atenuado)	Caso de tu paciente. La potencia de salida es mínima. Alta sospecha de estenosis fija.
        <=15	Potencia Moderada / Subóptima	Común en obstrucciones elásticas (HPB) o vejigas con fatiga muscular leve.
		<=35	Potencia Fisiológica Normal		Rango ideal. La energía de la vejiga se transmite de forma limpia al exterior.
		>35		Hiperpotencia de Salida			Chorro con fuerza balística. Típico de vejigas jóvenes altamente contráctiles.
     */ 
	$Pothyd = 0.5 * $DensidadOrina * $Qmax * pow($Vexit,2) * pow(10,-6);

    /* IRD: Índice de Resistencia Dinámica %
     * es el parámetro bioeléctrico y mecánico que mide la capacidad de respuesta que le queda al músculo de la vejiga antes de agotarse por completo [URA].
	En urología clínica, cuando un paciente sufre de una estenosis uretral crónica, la vejiga se ve obligada a hipertrofiarse (engrosarse) para empujar con más fuerza. El IRD calcula matemáticamente cuánta de esa fuerza es real y utilizable, y qué tan cerca está el órgano de sufrir una claudicación miogénica (es decir, volverse una vejiga "perezosa" o hipotónica irreversible) [URA].
    Rango  (%)	Clasificación de la Reserva	Diagnóstico Funcional de la Vejiga
    >95			Reserva Fisiológica Óptima		Músculo sano, joven y con total capacidad de adaptación.
    >=75		Reserva Compensada Vulnerable	Caso de tu paciente. La vejiga mantiene la fuerza, pero a expensas de un estrés mecánico crónico. Hay riesgo de desgaste si no se opera la estenosis.
    >=40		Fatiga Muscular Inicial			El detrusor empieza a fallar. Pérdida paulatina de la capacidad de vaciado completo.
    <40			Falla Miogénica Decompensada	Vejiga totalmente agotada. El daño al músculo es severo y la retención urinaria es inminente.*/
    $IRD = ($Qmax > 0) ? (125 / ($PdetQmax + 5 * $Qmax) * (1 - $BWI/10) * 100) : 0;

    /* DPventuri: Caída de presión por efecto Venturi cmH2O
     * mide cuánta de la presión estática que genera la vejiga se transforma en energía de velocidad al verse obligada a acelerar bruscamente a través de la estenosis.
	A diferencia de la pérdida por fricción viscosa de Darcy-Weisbach (que destruye la energía en forma de calor), el Efecto Venturi describe un intercambio cinético puro: para mantener el caudal constante en un conducto que se reduce drásticamente, la velocidad debe aumentar de golpe, lo que provoca una caída severa en la presión lateral del fluido [URA].
	Rango 	Clasificación Venturi					Condición del Conducto Uretral
	<0.5	Efecto Despreciable (Normal)			Uretra sana y uniforme. El fluido viaja a velocidad constante y suave de inicio a fin.
	<=2		Aceleración Moderada/Compensada			Estrechamiento elástico o HPB inicial. El fluido se acelera ligeramente.
    >2		Aceleración Crítica (Efecto Boquilla)	Caso de tu paciente. Firma matemática de una restricción geométrica fija (Estenosis severa).
	*/
    $DPventuri = 510 * (pow($Vexit,2) - pow(4 * $Qmax * pow(10,-6) / (pi() * pow(0.006,2)),2))/98.06;

    /* EHV: Eficiencia hidráulica del vaciado urinario %
     * Mide de forma porcentual (%) cuánta de la potencia mecánica y elástica total generada por el músculo detrusor de la vejiga logra transformarse en energía útil de salida en el chorro urinario [URA].
	En urología clínica, mientras que los índices de Schäfer u OCO te dicen qué tan obstruido está el conducto, el EHV le dice al médico qué tan eficiente es la micción completa como sistema hidráulico [URA]. Es la métrica que justifica el estado de fatiga vesical crónica del paciente.
	Rango de 	Clasificación Hidrodinámica			Diagnóstico Clínico y Pronóstico
    >45			Eficiencia Fisiológica Óptima		Típico de pacientes jóvenes y sanos. El conducto está libre y la energía se aprovecha al máximo.
    >=25		Eficiencia Conservada / Límite		Común en adultos mayores sanos o pacientes con hiperplasia prostática (HPB) leve.
    >=10		Incapacidad Hidrodinámica Moderada	El sistema empieza a experimentar pérdidas considerables. Requiere monitoreo médico.
    <10			Eficiencia Crítica / Falla de Carga	Caso de tu paciente. Firma matemática de una Estenosis Uretral Fija. El 90% de la fuerza se evapora dentro de la estrechez.
*/
    $EHV = $Pothyd / ($PdetQmax * $Qmax / 1.02) * pow(10,6);

    // siroky_score: Desviación estándar poblacional del Nomograma de Siroky para hombres (ICS)
    $flujo_medio_esperado = -1.24 + 1.83 * sqrt($Vvoid) - 0.016 * $Vvoid;
    $siroky = ($Qmax - $flujo_medio_esperado) / 3.25;

    $sem_Vflow = ($Vflow < 100) ? 'rojo' : (($Vflow <= 150) ? 'ambar' : 'verde');
    $sem_tvoid = ($tvoid > 60 || $tvoid < 10) ? 'rojo' : (($tvoid > 45 || $tvoid < 15) ? 'ambar' : 'verde');
    $sem_tflow = ($tflow > 50 || $tflow < 10) ? 'rojo' : (($tflow > 40 || $tflow < 15) ? 'ambar' : 'verde');
    $sem_tQmax = ($tQmax > 10) ? 'rojo' : (($tQmax > 6) ? 'ambar' : 'verde');
    $sem_Qave = ($Qave < 6) ? 'rojo' : (($Qave <= 10) ? 'ambar' : 'verde');
    $sem_t10 = ($t10 > 5) ? 'rojo' : (($t10 > 3) ? 'ambar' : 'verde');
    $sem_t95 = ($t95 > 55) ? 'rojo' : (($t95 > 42) ? 'ambar' : 'verde');
    $sem_q2 = ($q2 < 3) ? 'rojo' : (($q2 <= 5) ? 'ambar' : 'verde');
    $sem_Vdrop = ($Vdrop > 15) ? 'rojo' : (($Vdrop > 5) ? 'ambar' : 'verde');
    $sem_Qdrop = ($Qdrop > 1.5) ? 'rojo' : (($Qdrop > 0.5) ? 'ambar' : 'verde');
    $sem_SRmax = ($SRmax < 0.5) ? 'rojo' : (($SRmax < 1.5) ? 'ambar' : 'verde');
    $sem_acel_apertura = ($acel_apertura < 0.5) ? 'rojo' : (($acel_apertura < 1.2) ? 'ambar' : 'verde');
    $sem_Tdesa = ($Tdesa < 0.3) ? 'rojo' : (($Tdesa < 0.8) ? 'ambar' : 'verde');
    $sem_f_darcy = ($f_darcy > 0.150) ? 'rojo' : (($f_darcy > 0.080) ? 'ambar' : 'verde');
    $sem_pot_dis = ($pot_dis > 250) ? 'rojo' : (($pot_dis > 120) ? 'ambar' : 'verde');
    $sem_Efric = ($Efric > 8.0) ? 'rojo' : (($Efric > 4.5) ? 'ambar' : 'verde');
    $sem_Vexit = ($Vexit < 1.2) ? 'rojo' : (($Vexit <= 2.0) ? 'ambar' : 'verde');
    $sem_BWI = ($BWI < 15.0) ? 'rojo' : (($BWI <= 35.0) ? 'ambar' : 'verde');
    $sem_CVI = ($CVI > 35.0) ? 'rojo' : (($CVI > 15.0) ? 'ambar' : 'verde');
    $sem_Ptot = ($Ptot < 20.0) ? 'rojo' : (($Ptot <= 50.0) ? 'ambar' : 'verde');
    $sem_IRD = ($IRD < 1.20) ? 'rojo' : (($IRD <= 1.50) ? 'ambar' : 'verde');
    $sem_DPventuri = ($DPventuri > 1500) ? 'rojo' : (($DPventuri > 600) ? 'ambar' : 'verde');
    $sem_remax = ($remax > 2300) ? 'rojo' : (($remax > 1800) ? 'ambar' : 'verde');
    $sem_EHV = ($EHV < 75.0) ? 'rojo' : (($EHV < 90.0) ? 'ambar' : 'verde');
    $sem_Qmax = ($Qmax < 10) ? 'rojo' : (($Qmax <= 15) ? 'ambar' : 'verde');
    $sem_Vvoid = ($Vvoid < 100) ? 'rojo' : (($Vvoid <= 150) ? 'ambar' : 'verde');
    $sem_linpur = ($linPURR > 4) ? 'rojo' : (($linPURR >= 2) ? 'ambar' : 'verde');
    $sem_siroky = ($siroky < 0.75) ? 'rojo' : (($siroky <= 1.0) ? 'ambar' : 'verde');

    // --- 7. INYECCIÓN DEL ENTORNO TEXTUAL INTERACTIVO (MÉTRICAS 1 A 14) ---
$glosario_maestro_clinico = [
    'Vvoid' => [
        'orden' => 1, 'nomenclatura' => 'V<sub>void</sub>', 'nombre' => 'Volumen de Micción Total', 'unidad' => 'mL', 'grupo' => 'volumenes',
        'explicacion' => 'Cantidad volumétrica total de orina evacuada recolectada dentro de la ventana de lecturas efectivas del uroflujómetro. Variable fundamental de control urodinámico; estudios con volúmenes inferiores a 150 mL carecen de representatividad estadística para el diagnóstico validado de obstrucción.',
        'explicacion_paciente' => 'Es la cantidad total de orina que expulsó en el contenedor durante toda la prueba. Es una medida clave, ya que si orina muy poco, los resultados de fuerza no son estadísticamente confiables para dar un diagnóstico definitivo.',
        'rangos_normales' => 'Normal Adulto: Entre 150 y 500 mL (Verde).<br>Insuficiente para diagnóstico: Menor a 100 mL (Rojo).'
    ],
    'tvoid' => [
        'orden' => 2, 'nomenclatura' => 't<sub>void</sub>', 'nombre' => 'Tiempo de micción', 'unidad' => 's', 'grupo' => 'tiempos',
        'explicacion' => 'Duración temporal cronológica absoluta del registro urinario completo, abarcando desde la primera lectura de incremento positiva hasta el cese total del flujo, incluyendo de forma estricta la fase terminal de goteo secundario.',
        'explicacion_paciente' => 'Es el tiempo total en segundos que pasó desde que empezó a salir la primera gota de orina hasta que cayó la última gotita de la fase final en el equipo. Mide la duración completa de su ida al baño.',
        'rangos_normales' => 'Rango Normal: Entre 15 y 45 segundos para volúmenes estándar.'
    ],
    'Vflow' => [
        'orden' => 3, 'nomenclatura' => 'V<sub>flow</sub>', 'nombre' => 'Volumen de Flujo Efectivo', 'unidad' => 'mL', 'grupo' => 'volumenes',
        'explicacion' => 'Masa líquida total evacuada durante los intervalos de tiempo en los que el flujo superó el umbral crítico de 0.5 mL/s. Excluye el volumen de goteo final no contributivo para el análisis contráctil del detrusor.',
        'explicacion_paciente' => 'Es la cantidad de orina que logró evacuar con un chorro continuo y firme, sin contar las gotitas aisladas del final. Sirve para ver el volumen real que su vejiga tenía almacenado y listo para expulsar con fuerza.',
        'rangos_normales' => 'Volumen Funcional Óptimo: Entre 150 y 450 mL (Verde).<br>Capacidad disminuida: Menor a 150 mL.'
    ],
    'tflow' => [
        'orden' => 4, 'nomenclatura' => 't<sub>flow</sub>', 'nombre' => 'Tiempo de flujo', 'unidad' => 's', 'grupo' => 'tiempos',
        'explicacion' => 'Duración neta acumulada de la micción activa, contabilizando exclusivamente los intervalos temporales donde la velocidad de vaciado fue igual o superior a 0.5 mL/s. La diferencia estricta entre tvoid y tflow cuantifica numéricamente el grado de intermitencia miccional.',
        'explicacion_paciente' => 'Es el tiempo neto en segundos que estuvo saliendo un chorro real y continuo de orina. Si este tiempo es mucho más corto que el tiempo total de micción, significa que su chorro se interrumpió o goteó demasiado.',
        'rangos_normales' => 'Normal: Muy cercano al tiempo de micción en pacientes sin obstrucción.'
    ],
    'tQMax' => [
        'orden' => 5, 'nomenclatura' => 't<sub>Qmax</sub>', 'nombre' => 'Tiempo de flujo máximo', 'unidad' => 's', 'grupo' => 'tiempos',
        'explicacion' => 'Intervalo temporal desde el inicio del flujo efectivo hasta alcanzar la velocidad pico (Qmax). Refleja la fase de latencia y la velocidad de reclutamiento de las fibras contráctiles del detrusor junto con la apertura coordinada del cuello vesical.',
        'explicacion_paciente' => 'Es el tiempo que tardó su cuerpo en alcanzar la fuerza máxima del chorro desde que empezó a salir la orina. Lo normal es alcanzar el pico de fuerza rápidamente en los primeros segundos.',
        'rangos_normales' => 'Normal: Menor a 5 segundos (Verde).<br>Fases prolongadas denotan apertura vesical perezosa.'
    ],
    'Qmax' => [
        'orden' => 6, 'nomenclatura' => 'Q<sub>max</sub>', 'nombre' => 'Flujo Máximo', 'unidad' => 'mL/s', 'grupo' => 'flujos',
        'explicacion' => 'Punto máximo de la curva volumétrica de vaciado. Representa la capacidad eyectora pico balanceada entre la presión de contracción del detrusor y la resistencia friccional de la uretra. Un valor disminuido es indicativo de obstrucción infravesical (v.gr., hiperplasia prostática, estenosis) o hipocontractilidad del detrusor.',
        'explicacion_paciente' => 'Es la velocidad más rápida a la que salió la orina durante su visita al baño. Mide la fuerza con la que su vejiga puede empujar y qué tan libre está el conducto de salida. Si el valor es bajo, significa que la orina sale con poca fuerza o que hay algo obstruyendo el paso.',
        'rangos_normales' => 'Normal: Mayor a 15 mL/s (Verde).<br>Precaución: Entre 10 y 15 mL/s (Ámbar).<br>Alerta Obstructiva: Menor a 10 mL/s (Rojo).'
    ],
    'Qave' => [
        'orden' => 7, 'nomenclatura' => 'Q<sub>ave</sub>', 'nombre' => 'Flujo Promedio', 'unidad' => 'mL/s', 'grupo' => 'flujos',
        'explicacion' => 'Cociente matemático entre el volumen total de flujo efectivo (Vflow) y el tiempo neto de flujo activo (tflow). Evalúa la sostenibilidad global de la micción sin sesgos por picos transitorios accidentales. Curvas mesetarias prolongadas alteran severamente esta relación.',
        'explicacion_paciente' => 'Es la velocidad media de la orina a lo largo de toda la descarga. Ayuda al médico a saber si mantuvo un ritmo constante o si el chorro fue débil y goteando la mayor parte del tiempo.',
        'rangos_normales' => 'Normal: Mayor a 10 mL/s (Verde).<br>Deseable: Mayor a 12 mL/s en adultos sanos.'
    ],
    't10' => [
        'orden' => 8, 'nomenclatura' => 't<sub>10</sub>', 'nombre' => 'Tiempo al 10% de volumen', 'unidad' => 's', 'grupo' => 'tiempos',
        'explicacion' => 'Tiempo transcurrido para desalojar el primer 10% del volumen vesical total. Parámetro crítico para cuantificar la fase inicial de eyección y evaluar la presencia de disinergia esfinteriana o retraso en la apertura miccional.',
        'explicacion_paciente' => 'Es el tiempo medido en segundos que tardó en salir la primera décima parte de toda su orina. Mide la rapidez de respuesta de los músculos al abrirse.',
        'rangos_normales' => 'Normal: Menor a 3 segundos en micciones sin obstrucción.'
    ],
    't95' => [
        'orden' => 9, 'nomenclatura' => 't<sub>95</sub>', 'nombre' => 'Tiempo al 95% de volumen', 'unidad' => 's', 'grupo' => 'tiempos',
        'explicacion' => 'Intervalo requerido para evacuar el 95% del volumen total. Delimita el final del vaciado vesical principal y marca el inicio de la transición hacia la fase puramente elástica de goteo pasivo o residuo terminal.',
        'explicacion_paciente' => 'Indica los segundos que pasaron hasta que terminó de salir casi toda la orina (el 95%). A partir de aquí, lo que queda es solo el goteo final.',
        'rangos_normales' => 'Rango Esperado: Correlacionado directamente con el volumen total evacuado.'
    ],
    'Q2' => [
        'orden' => 10, 'nomenclatura' => 'Q<sub>2</sub>', 'nombre' => 'Flujo a los 2 segundos', 'unidad' => 'mL/s', 'grupo' => 'flujos',
        'explicacion' => 'Velocidad de flujo volumétrico registrada exactamente a los 2.0 segundos del inicio del estudio. Cuantifica de forma estricta la potencia inicial de la descarga y la efectividad del reflejo de relajación del esfínter estriado.',
        'explicacion_paciente' => 'Es la velocidad que tenía el chorro justo a los dos segundos de haber empezado. Permite saber si el inicio de la micción fue enérgico o si comenzó con timidez y lentitud.',
        'rangos_normales' => 'Normal: Mayor a 4 mL/s (Verde) en pacientes con adecuada apertura de cuello.'
    ],
    'Vdrop' => [
        'orden' => 11, 'nomenclatura' => 'V<sub>drop</sub>', 'nombre' => 'Volumen de goteo final', 'unidad' => 'mL', 'grupo' => 'volumenes',
        'explicacion' => 'Masa líquida residual evacuada en la fase posterior al límite de lecturas efectivas (goteo terminal real). Volúmenes elevados son indicativos de atrapamiento urinario bulbo-uretral, divertículos o pérdida de complianza elástica en el mecanismo de vaciado del conducto.',
        'explicacion_paciente' => 'Mide la cantidad de orina que quedó saliendo en forma de gotitas al final de la micción. Un volumen alto de goteo explica esa molesta sensación de seguir mojando la ropa interior después de salir del baño.',
        'rangos_normales' => 'Normal: Menor a 5 mL (Verde).<br>Goteo Terminal Significativo: Mayor a 15 mL (Ámbar).'
    ],
    'Qdrop' => [
        'orden' => 12, 'nomenclatura' => 'Q<sub>drop</sub>', 'nombre' => 'Flujo promedio de goteo', 'unidad' => 'mL/s', 'grupo' => 'flujos',
        'explicacion' => 'Velocidad de flujo volumétrico media registrada durante la fase residual de goteo post-miccional. Refleja la inercia elástica de la uretra esponjosa y la ausencia de una contracción terminal compensatoria efectiva.',
        'explicacion_paciente' => 'Es la velocidad promedio a la que salieron las gotitas al final de la prueba. Permite evaluar si el goteo final fue corto y rápido o prolongado y molesto.',
        'rangos_normales' => 'Normal: Valores muy bajos, cercanos a cero (Verde).'
    ],
    'SlewRate' => [
        'orden' => 13, 'nomenclatura' => 'SR<sub>max</sub>', 'nombre' => 'Slew Rate Máx', 'unidad' => 'mL/s<sup>2</sup>', 'grupo' => 'flujos',
        'explicacion' => 'Máxima derivada temporal de la velocidad de flujo (\(dQ/dt\)). Cuantifica matemáticamente la velocidad punta de aceleración del chorro urinario. Es un reflejo fidedigno del reclutamiento de fibras neuromotoras del detrusor y de la integridad del arco reflejo sacro.',
        'explicacion_paciente' => 'Mide qué tan rápido se aceleró el chorro de orina en su momento de mayor impulso inicial. Evalúa la fuerza y la rapidez con la que reaccionan los nervios y los músculos de la vejiga para iniciar el vaciado.',
        'rangos_normales' => 'Normal: Valores positivos altos indican excelente respuesta y fuerza contráctil.'
    ],
    'AcelApertura' => [
        'orden' => 14, 'nomenclatura' => 'a<sub>ap</sub>', 'nombre' => 'Aceleración de Apertura', 'unidad' => 'mL/s<sup>2</sup>', 'grupo' => 'flujos',
        'explicacion' => 'Pendiente media de aceleración calculada como el cociente directo entre Qmax and tQmax. Evalúa la energía hidrodinámica inicial disponible para vencer la inercia del esfínter urinario. Retrasos denotan rigidez del cuello o compresión prostática extrínseca.',
        'explicacion_paciente' => 'Mide la aceleración promedio del chorro desde que sale la primera gota hasta que alcanza su punto de máxima fuerza. Sirve para ver qué tan elásticos y ágiles son los tejidos de salida.',
        'rangos_normales' => 'Normal: Mayor a 1.5 mL/s² en vías urinarias libres de obstrucción.'
    ],
    'Decel' => [
        'orden' => 15, 'nomenclatura' => 'Tasa<sub>decel</sub>', 'nombre' => 'Tasa de Deceleración', 'unidad' => 'mL/s<sup>2</sup>', 'grupo' => 'flujos',
        'explicacion' => 'Velocidad media de caída del flujo desde el punto máximo pico hasta el cierre del vaciado elástico efectivo (\(\Delta Q / \Delta t\)). Pendientes extremadamente aplanadas denotan vaciado por rebosamiento o claudicación contráctil prematura de la fibra muscular lisa.',
        'explicacion_paciente' => 'Mide qué tan rápido empezó a perder fuerza el chorro después de alcanzar el punto máximo. Si el chorro disminuye su fuerza de manera muy lenta o intermitente, es señal de fatiga en la vejiga.',
        'rangos_normales' => 'Normal: Caída elástica fluida y continua sin interrupciones.'
    ],
    'Rhodarcy' => [
        'orden' => -1, 'nomenclatura' => 'f<sub>Darcy</sub>', 'nombre' => 'Coeficiente de Darcy', 'unidad' => '', 'grupo' => 'fluidos',
        'explicacion' => 'Coeficiente de fricción dimensional interno de Darcy para tubos circulares lisos (\(64/Re\)). Determina la resistencia viscosa intrínseca que opone la columna de orina a deslizarse sobre sí misma en regímenes de baja velocidad.',
        'explicacion_paciente' => 'Mide el rozamiento interno que experimenta el propio líquido al resbalar a través del conducto. Evalúa las pérdidas de carga elásticas puramente por viscosidad.',
        'rangos_normales' => 'Normal: Valores bajos balanceados con la densidad de la orina.'
    ],
    'Potdis' => [
        'orden' => -1, 'nomenclatura' => 'P<sub>ot dis</sub>', 'nombre' => 'Pérdida por Disipación', 'unidad' => 'mW', 'grupo' => 'fluidos',
        'explicacion' => 'Potencia degradada por disipación viscosa por segundo. Cuantifica numéricamente los vatios de energía útil elástica convertidos irreversiblemente en energía térmica (calor por fricción) debido a la resistencia hidrodinámica del tracto de salida.',
        'explicacion_paciente' => 'Representa los vatios de potencia elástica útil que se perdieron y se convirtieron en calor debido a la resistencia viscosa dentro del conducto. Es energía desperdiciada que no sirvió para expulsar la orina.',
        'rangos_normales' => 'Normal: Pérdida mínima en conductos libres de procesos obstructivos.'
    ],
    'Efric' => [
        'orden' => -1, 'nomenclatura' => 'E<sub>fric</sub>', 'nombre' => 'Pérdida por Fricción', 'unidad' => 'J/Kg', 'grupo' => 'fluidos',
        'explicacion' => 'Pérdida de presión total por resistencia viscosa a lo largo del conducto uretral estimada por hidrodinámica de Darcy-Weisbach. Cuantifica de forma estricta la degradación de carga hidrodinámica debido al rozamiento de la orina con las paredes del epitelio.',
        'explicacion_paciente' => 'Es la presión elástica que se perdió dentro del conducto debido al rozamiento del líquido contra las paredes de la uretra. Si el conducto está inflamado, comprimido o estrecho, esta pérdida por fricción se eleva.',
        'rangos_normales' => 'Normal: Valores mínimos en conductos uretrales elásticos y sanos.'
    ],
	'LinPURR' => [
        'orden' => 16, 'nomenclatura' => 'LinPURR', 'nombre' => 'Índice de Schäfer', 'unidad' => '', 'grupo' => 'fluidos',
        'explicacion' => 'Índice de Resistencia Uretral Linealizado de Schäfer. Representa matemáticamente el grado de obstrucción infravesical correlacionando la caída de presión estática con el flujo pico. Valores elevados confirman patrones obstructivos mecánicos o funcionales (grados de Schäfer 0 a VI).',
        'explicacion_paciente' => 'Es una puntuación científica que mide qué tanta resistencia ofrece su conducto (uretra) al paso de la orina. Si este índice sale elevado, confirma que hay una estrechez o una próstata aumentada bloqueando el flujo.',
        'rangos_normales' => 'Normal / No obstructivo: Menor a 2 (Verde).<br>Equívoco: Entre 2 y 4 (Ámbar).<br>Altamente Obstructivo: Mayor a 4 (Rojo).'
    ],
    'Vexit' => [
        'nomenclatura' => 'v<sub>exit</sub>', 'nombre' => 'Velocidad de Salida', 'unidad' => 'm/s', 'grupo' => 'fluidos',
        'explicacion' => 'Velocidad lineal estimada del fluido al cruzar el meato urinario externo. Calculada a partir de la ecuación de continuidad hidrodinámica basada en un área seccional anatómica estándar. Es crucial para el análisis cinemático del chorro libre.',
        'explicacion_paciente' => 'Es la velocidad real en metros por segundo a la que salió el chorro por la punta del conducto. Permite entender la velocidad física lineal de expulsión.',
        'rangos_normales' => 'Normal: Velocidades elásticas continuas libres de obstrucción externa.'
    ],
    'BWI' => [
        'nomenclatura' => 'BWI', 'nombre' => 'Índice de Trabajo Vesical', 'unidad' => 'mL<sup>2</sup>/s', 'grupo' => 'fluidos',
        'explicacion' => 'Bladder Work Index (Índice de Trabajo Vesical Estimado). Producto matemático que correlaciona el volumen total eyectado con la velocidad pico alcanzada. Provee una aproximación indirecta no invasiva a la energía mecánica disipada por el músculo detrusor durante el ciclo de vaciado.',
        'explicacion_paciente' => 'Es un indicador del esfuerzo global que tuvo que hacer el músculo de su vejiga para vaciarse. Una puntuación muy alta puede significar que la vejiga está trabajando horas extra para vencer una obstrucción.',
        'rangos_normales' => 'Normal Adulto: Correlacionado con el volumen; valores estables indican buena reserva muscular.'
    ],
    'CIV' => [
        'nomenclatura' => 'CIV', 'nombre' => 'Coeficiente Variabilidad CIV', 'unidad' => '%', 'grupo' => 'flujos',
        'explicacion' => 'Coeficiente de Intermitencia y Variabilidad Urodinámica. Medida de dispersión estadística estandarizada de la velocidad de flujo. Valores altos cuantitativamente confirman patrones miccionales fraccionados, titubeantes o con severa prensa abdominal sustitutiva.',
        'explicacion_paciente' => 'Mide qué tan unstable o intermitente fue su chorro de orina. Un valor alto significa que el chorro sufría bajas y altas bruscas de fuerza de forma constante, en lugar de mantenerse liso, continuo y firme.',
        'rangos_normales' => 'Normal: Valores bajos, cercanos a cero (Chorro estable y libre de intermitencias).'
    ],
    'Ptot' => [
        'nomenclatura' => 'P<sub>tot</sub>', 'nombre' => 'Momentum Lineal Vesical', 'unidad' => 'g·m/s', 'grupo' => 'fluidos',
        'explicacion' => 'Momentum o cantidad de movimiento lineal transferido a la masa fluida evacuada (\(m \cdot v\)). Evalúa la masa total proyectada en función de su velocidad terminal, sirviendo como métrica de la persistencia inercial del chorro urinario.',
        'explicacion_paciente' => 'Es la cantidad de empuje o impulso total acumulado por la orina que salió de su cuerpo. Mide el impacto combinado del peso del líquido orinado y la velocidad que alcanzó.',
        'rangos_normales' => 'Normal: Valores stables en micciones continuas de volumen adecuado.'
    ],
    'IRD' => [
        'nomenclatura' => 'IRD', 'nombre' => 'Reserva del Detrusor', 'unidad' => '%', 'grupo' => 'fluidos',
        'explicacion' => 'Índice de Reserva Funcional del Detrusor. Cociente exacto entre el flujo máximo y el flujo promedio (\(Q_{max}/Q_{ave}\)). Evalúa la capacidad dinámica del músculo vesical para generar picos transitorios sobre la media de evacuación; índices planos denotan fatiga o claudicación contráctil.',
        'explicacion_paciente' => 'Evalúa la fuerza de reserva que le queda al músculo de su vejiga para dar picos de potencia por encima del promedio general de la micción. Un índice muy plano avisa sobre una musculatura cansada o con poca fuerza de reserva.',
        'rangos_normales' => 'Normal: Mayor a 1.5 (Verde). Un valor plano cercano a 1.0 denota fatiga o claudicación muscular.'
    ],
	'Venturi' => [
        'nomenclatura' => '&Delta;P<sub>Venturi</sub>', 'nombre' => 'Efecto Venturi Uretral', 'unidad' => 'Pa', 'grupo' => 'fluidos',
        'explicacion' => 'Caída de presión estática dinámica inducida por el efecto Venturi debido a la aceleración cinética del fluido en el estrechamiento del cuello vesical. Cuantifica la conversión de energía de presión en energía cinética funcional.',
        'explicacion_paciente' => 'Mide la caída de presión que sufre la orina debido a la aceleración que experimenta al pasar por zonas estrechas. Es un fenómeno físico que explica cómo el líquido gana velocidad al comprimirse en un tubo.',
        'rangos_normales' => 'Normal: Valores óptimos balanceados con la elasticidad anatómica.'
    ],
    'Remax' => [
        'nomenclatura' => 'Re<sub>max</sub>', 'nombre' => 'Número de Reynolds Máx', 'unidad' => '', 'grupo' => 'fluidos',
        'explicacion' => 'Número de Reynolds Máximo intrauretral. Ecuación fundamental que clasifica el régimen del fluido. Valores inferiores a 2300 confirman un flujo puramente Laminar (ordenado en láminas elásticas), mientras que picos superiores rompen la estabilidad generando flujos Turbulentos con alta disipación vorticial.',
        'explicacion_paciente' => 'Es un número utilizado en física para saber si la orina sale de forma ordenada y recta (Flujo Laminar) o si sale haciendo remolinos y torbellinos caóticos dentro del conducto (Flujo Turbulento), lo cual desgasta la energía.',
        'rangos_normales' => 'Laminar: Menor a 2300 (Verde).<br>Turbulento / Caótico: Mayor a 2300 (Ámbar).'
    ],
    'EHV' => [
        'nomenclatura' => 'EHV', 'nombre' => 'Eficiencia Hidrodinámica', 'unidad' => '%', 'grupo' => 'fluidos',
        'explicacion' => 'Índice de Eficiencia Hidrodinámica Vesical (EHV). Porcentaje elástico útil de potencia conservada en la descarga urinaria. Una eficiencia disminuida confirma que la vejiga está gastando la mayor parte de su energía metabólica celular en vencer la fricción obstructiva en lugar de proyectar el chorro.',
        'explicacion_paciente' => 'Es la calificación porcentual de la eficiencia de su sistema al orinar. Si sale cercana al 100%, significa que toda la fuerza de su vejiga se aprovechó limpiamente en expulsar la orina; valores bajos avisan que la fuerza se desperdicia en vencer la estrechez.',
        'rangos_normales' => 'Normal Óptimo: Mayor al 90% (Verde).<br>Eficiencia Degradada: Menor al 75%.'
    ],
    'Siroky' => [
        'nomenclatura' => 'Siroky<sub>score</sub>', 'nombre' => 'Nomograma de Siroky', 'unidad' => '', 'grupo' => 'fluidos',
        'explicacion' => 'Puntuación predictiva basada en el Nomograma Clínico de Siroky y Liverpool. Modela matemáticamente el Flujo Máximo esperado en función de la raíz cuadrada del volumen funcional desalojado. Desviaciones por debajo de 0.75 confirman de forma robusta una restricción de flujo patológica obstructiva independiente del volumen.',
        'explicacion_paciente' => 'Es una herramienta internacional que compara matemáticamente la fuerza máxima de su chorro contra lo que se esperaría de un paciente sano que orinó exactamente su misma cantidad de líquido. Descarta falsos diagnósticos cuando orina poco.',
        'rangos_normales' => 'Flujo Normal Ideal: Mayor a 1.0 (Verde).<br>Patrón Obstructivo Clínico: Menor a 0.75 (Rojo).'
    ]
];


    $calculos_datos_dinamicos = [
        'Vvoid'        => ['valor' => number_format($Vvoid, 3),        'semaforo' => $sem_Vvoid],
        'tvoid'        => ['valor' => number_format($tvoid, 3),        'semaforo' => 'verde'],
        'Vflow'        => ['valor' => number_format($Vflow, 3),        'semaforo' => $sem_Vvoid],
        'tflow'        => ['valor' => number_format($tflow, 3),        'semaforo' => 'verde'],
        'tQMax'        => ['valor' => number_format($tQmax, 3),        'semaforo' => 'verde'],
        'Qmax'         => ['valor' => number_format($Qmax, 3),         'semaforo' => $sem_Qmax],
        'Qave'         => ['valor' => number_format($Qave, 3),         'semaforo' => $sem_Qmax],
        't10'          => ['valor' => number_format($t10, 3),          'semaforo' => 'verde'],
        't95'          => ['valor' => number_format($t95, 3),          'semaforo' => 'verde'],
        'Q2'           => ['valor' => number_format($q2, 3),           'semaforo' => 'verde'],
        'Vdrop'        => ['valor' => number_format($Vdrop, 3),        'semaforo' => $sem_Vgoteo],
        'Qdrop'         => ['valor' => number_format($Qdrop, 3),        'semaforo' => $sem_Qgoteo],
        'SlewRate'     => ['valor' => number_format($SRmax, 3),        'semaforo' => 'verde'],
        'AcelApertura' => ['valor' => number_format($acel_apertura, 3), 'semaforo' => 'verde'],
        'Decel'        => ['valor' => number_format($Tdesa, 3),        'semaforo' => 'verde'],
        'Rhodarcy'     => ['valor' => number_format($f_darcy, 3),      'semaforo' => 'verde'],
        'Potdis'       => ['valor' => number_format($pot_dis, 3),      'semaforo' => 'verde'],
        'Efric'        => ['valor' => number_format($Efric, 3),        'semaforo' => 'verde'],
        'LinPURR'      => ['valor' => number_format($linPURR, 3),      'semaforo' => $sem_linpur],
        'Vexit'        => ['valor' => number_format($Vexit, 3),        'semaforo' => 'verde'],
        'BWI'          => ['valor' => number_format($BWI, 3),           'semaforo' => 'verde'],
        'CIV'          => ['valor' => number_format($CVI, 2),           'semaforo' => 'verde'],
        'Ptot'         => ['valor' => number_format($Ptot, 1),           'semaforo' => 'verde'],
        'IRD'          => ['valor' => number_format($IRD, 2),           'semaforo' => 'verde'],
        'Venturi'      => ['valor' => number_format($DPventuri, 3),    'semaforo' => 'verde'],
        'Remax'        => ['valor' => (int)$remax,                     'semaforo' => 'verde'],
        'EHV'          => ['valor' => number_format($EHV, 3),          'semaforo' => 'verde'],
        'Siroky'       => ['valor' => number_format($siroky, 3),       'semaforo' => $sem_siroky]
    ];

    // --- 📍 OPTIMIZACIÓN DE CONTRAL: FUMIGACIÓN DE DECIMALES BASURA EN EL VECTOR [STEM] ---
    // Barremos el arreglo de incrementos de caudal para redondearlos estrictamente a 3 decimales fijos
    $flujo_mls_purificado = [];
    if (is_array($incremento_nuevo)) {
        foreach ($incremento_nuevo as $valorLectura) {
            $flujo_mls_purificado[] = round(floatval($valorLectura), 3);
        }
    }

    // Armamos el registro de la micción actual libre de sobrepeso de textos repetidos
    $lista_registros_micciones[] = [
        'idMix'             => $id_ContadorTotal,
        'idDia'             => $id_dia_float,
        'idDilatacion'      => $id_dilatacion_float,
        'frSonda'           => intval($sonda_fr_detectado),
        'fecha'             => $fecha_mix_final,
        'tiempo_seg'        => $dt_seg * 1000,
        'flujo_mls'         => $flujo_mls_purificado, // Vector limpio libre de colas numéricas infinitas
        'volTotal'          => $volumen_total_calculado,
        'calculos'          => $calculos_datos_dinamicos 
    ];
    $id_ContadorTotal++;

} // <-- AQUÍ CIERRA TU BUCLE FOREACH PRINCIPAL DE LAS MICCIONES (TU LLAVE ORIGINAL)

// =========================================================================
// --- PACKAGING FINAL DEL JSON COMPRIMIDO DE ALTA VELOCIDAD ---
// =========================================================================
// Encapsulamos el glosario estático único y el vector de micciones purificadas
$respuesta_unificada_ligera = [
    'glosario_clinico' => $glosario_maestro_clinico, // Viaja una sola vez en la cabecera
    'registros'        => $lista_registros_micciones // Datos dinámicos ligeros a dieta
];

header('Content-Type: application/json; charset=utf-8');
echo json_encode($respuesta_unificada_ligera);
exit;