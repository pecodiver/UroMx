<?php
header('Content-Type: application/json; charset=utf-8');
$filename = __DIR__ . '/CAUDAL.txt';
if (!file_exists($filename)) {
    echo json_encode(['error' => 'El archivo CAUDAL.txt no se encuentra en la raiz del servidor.']);
    exit;
}
$lineas = file($filename, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
$respuesta = [];
$mapa_ciclos_dilatacion = [];
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
    $fecha_completa = trim($datos[0]); // "dd-mm-yyyy hh:mm:ss"
    $sonda_fr_detectado = 0;
    $es_miccion_apertura = 0;
    if (substr($fecha_completa, 0, 1) === '@') {
        $partes_arroba = explode('@', $fecha_completa);
        if (count($partes_arroba) >= 3) {
            $fecha_completa = trim($partes_arroba[2]); // Aísla la fecha limpia "dd/mm/yy hh:mm"
        }
    }
    $ciclo_asignado = isset($mapa_ciclos_dilatacion[$idx_linea]) ? $mapa_ciclos_dilatacion[$idx_linea] : 0;
    $sonda_fr_detectado = isset($mapa_calibres_sonda[$idx_linea]) ? $mapa_calibres_sonda[$idx_linea] : 0;
    $es_miccion_apertura = isset($es_apertura_ciclo[$idx_linea]) ? $es_apertura_ciclo[$idx_linea] : 0;
    $id_miccion = (strlen($fecha_completa) >= 16) ? substr($fecha_completa, 0, 5) . ' ' . substr($fecha_completa, 11, 5) : $fecha_completa;
    $unidad_tiempo_ms = floatval(trim($datos[1]));
    $lecturas_efectivas = intval(trim($datos[2]));
    $secuencia_cruda = implode(',', array_slice($datos, 3));
    $incrementos_crudos = array_slice($datos, 3);
    $incrementos_totales = [];
    foreach ($incrementos_crudos as $inc_crud) {
        $val = floatval(trim($inc_crud))/1000;
        // Se limpian ruidos espurios o lecturas por debajo de cero absoluto
        $incrementos_totales[] = ($val < 0) ? 0.0 : $val;
    }
    $tiempo_seg = [];
    $volumen_acumulado = [];
    $flujo_mls = [];
    $vol_acumulado_temp = 0;
    $dt_seg = $unidad_tiempo_ms / 1000.0;
    foreach ($incrementos_totales as $index => $inc_vol) {
        $t_actual = $index * $dt_seg;
        $vol_acumulado_temp += $inc_vol;
        $flujo_inst = ($dt_seg > 0) ? ($inc_vol / $dt_seg) : 0;

        $tiempo_seg[] = round($t_actual, 3);
        $volumen_acumulado[] = round($vol_acumulado_temp, 3);
        $flujo_mls[] = round($flujo_inst, 3);
    }
    if (empty($tiempo_seg)) continue;
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
    $Vflow = end($volumen_acumulado_calc); 
    $Qmax = count($flujo_mls_calc) > 0 ? max($flujo_mls_calc) : 0;
    $idx_Qmax = array_search($Qmax, $flujo_mls_calc);
    $tQmax = ($idx_Qmax !== false) ? ($idx_Qmax + 1) * $dt_seg : 0;
    $tvoid = (count($incrementos_totales)) * $dt_seg; 
    $lecturas_con_flujo = 0;
    foreach ($flujo_mls_calc as $f) {
        if ($f >= 0.1) $lecturas_con_flujo++;
    }
    $tflow = $lecturas_con_flujo * $dt_seg;
    $Qave = ($tflow > 0) ? ($Vflow / $tflow) : 0;
    $Vflow = 0;
    foreach ($incrementos_calculo as $idx => $inc) {
        if (isset($flujo_mls_calc[$idx]) && $flujo_mls_calc[$idx] >= 0.1) $Vflow += $inc;
    }
    $t10 = 0; $t95 = 0;
    foreach ($volumen_acumulado_calc as $idx => $vol) {
        if ($t10 == 0 && $vol >= ($Vflow * 0.10)) $t10 = $tiempo_seg_calc[$idx];
        if ($t95 == 0 && $vol >= ($Vflow * 0.95)) $t95 = $tiempo_seg_calc[$idx];
    }
    $q2 = 0;
    foreach ($tiempo_seg_calc as $idx => $t) {
        if ($t >= 2.0) { $q2 = $flujo_mls_calc[$idx]; break; }
    }
    $SRmax = 0;
    for ($i = 1; $i < count($flujo_mls_calc); $i++) {
        $diff_f = $flujo_mls_calc[$i] - $flujo_mls_calc[$i-1];
        $sr = $diff_f / $dt_seg;
        if ($sr > $SRmax) $SRmax = $sr;
    }
    $acel_apertura = ($tQmax > 0) ? ($Qmax / $tQmax) : 0;
    $incrementos_goteo = array_slice($incrementos_totales, $lecturas_efectivas);
    $Vdrop = 0;
    foreach ($incrementos_goteo as $inc_g) {
        if ($inc_g > 0) $Vdrop += $inc_g;
    }
    $goteo_tiempo = count($incrementos_goteo) * $dt_seg;
    $Qdrop = ($goteo_tiempo > 0) ? ($Vdrop / $goteo_tiempo) : 0;
    $Vvoid = $Vflow + $Vdrop;
    $t_desf = (end($tiempo_seg_calc)) - $tQmax;
    $Tdesa = ($t_desf > 0) ? ($Qmax / $t_desf) : 0;
    $Vexit = 0.14147 * $Qmax;
    $DiamEfectivoEstenosis = ($Vexit > 0) ? (2 * sqrt($Qmax / pi() * $Vexit)) : 3;
	$DiamConducto = sqrt((4 * $Qmax / 1000000)/(pi()*$Vexit));
    $ViscosidadDinamica = 0.001;  // Pa
	$DensidadOrina = 1020;  // kg/m3
	$remax = $DensidadOrina * $Vexit * $DiamConducto / $ViscosidadDinamica;
	$Constante = 0.3164;
    $f_darcy = ($remax > 0) ? ($Constante / pow($remax, 0.25)) : 0;
    $Efric = $f_darcy * 150 / $DiamEfectivoEstenosis * pow($Vexit, 2) / 2;
    $pot_dis = $DensidadOrina * $Qmax * pow(10,-3) * $Efric;
	$PdetQmax = 64*(1-exp(-0.0075*($Vvoid-50)));
	$linPURR = $PdetQmax/(40+(2*$Qmax));  
	$BWI = ($PdetQmax * $Qmax / 100) + (8.266 * 0.0001 * pow($Qmax, 3) / pow($DiamEfectivoEstenosis, 4));
    $CVI = ($Qave > 0) ? ((($Qmax - $Qave) / 2 + ( 0.15 * $Qave )) / $Qave * 100) : 0;
	$Ptot =    $DensidadOrina * $Vvoid * $Qave * 4 * pow(10, -3) / (pi() * pow($DiamEfectivoEstenosis,2));
	$Pothyd = 0.5 * $DensidadOrina * $Qmax * pow($Vexit,2) * pow(10,-6);
    $IRD = ($Qmax > 0) ? (125 / ($PdetQmax + 5 * $Qmax) * (1 - $BWI/10) * 100) : 0;
    $DPventuri = 510 * (pow($Vexit,2) - pow(4 * $Qmax * pow(10,-6) / (pi() * pow(0.006,2)),2))/98.06;
    $EHV = $Pothyd / ($PdetQmax * $Qmax / 1.02) * pow(10,6);
    $flujo_medio_esperado = -1.24 + 1.83 * sqrt($Vvoid) - 0.016 * $Vvoid;
    $siroky = ($Qmax - $flujo_medio_esperado) / 3.25;
    $sem_Qmax = ($Qmax < 10) ? 'rojo' : (($Qmax <= 15) ? 'ambar' : 'verde');
    $sem_Vvoid = ($Vvoid < 100) ? 'rojo' : (($Vvoid <= 150) ? 'ambar' : 'verde');
    $sem_linpur = ($linpur > 4) ? 'rojo' : (($linpur >= 2) ? 'ambar' : 'verde');
    $sem_siroky = ($siroky < 0.75) ? 'rojo' : (($siroky <= 1.0) ? 'ambar' : 'verde');
    $calculos = [
        'Vvoid' => ['nomenclatura' => 'V<sub>void</sub>', 'nombre' => 'Volumen de Micción Total', 'valor' => number_format($Vvoid, 3), 'unidad' => 'mL', 'semaforo' => $sem_Vvoid, 'grupo' => 'volumenes','explicacion' => 'Explic','explicacion_paciente' => 'textoP','rangos_normales' => 'rango'],
        'tvoid' => ['nomenclatura' => 't<sub>void</sub>', 'nombre' => 'Tiempo de micción', 'valor' => number_format($tvoid, 3), 'unidad' => 's', 'semaforo' => 'verde', 'grupo' => 'tiempos','explicacion' => 'Explic','explicacion_paciente' => 'textoP','rangos_normales' => 'rango'],
        'Vflow' => ['nomenclatura' => 'V<sub>flow</sub>', 'nombre' => 'Volumen de Flujo Efectivo', 'valor' => number_format($Vflow, 3), 'unidad' => 'mL', 'semaforo' => $sem_Vvoid, 'grupo' => 'volumenes','explicacion' => 'Explic','explicacion_paciente' => 'textoP','rangos_normales' => 'rango'],
        'tflow' => ['nomenclatura' => 't<sub>flow</sub>', 'nombre' => 'Tiempo de flujo', 'valor' => number_format($tflow, 3), 'unidad' => 's', 'semaforo' => 'verde', 'grupo' => 'tiempos','explicacion' => 'Explic','explicacion_paciente' => 'textoP','rangos_normales' => 'rango'],
        'tflowMax' => ['nomenclatura' => 't<sub>Qmax</sub>', 'nombre' => 'Tiempo de flujo máximo', 'valor' => number_format($tQmax, 3), 'unidad' => 's', 'semaforo' => 'verde', 'grupo' => 'tiempos','explicacion' => 'Explic','explicacion_paciente' => 'textoP','rangos_normales' => 'rango'],
	    'Qmax' => ['nomenclatura' => 'Q<sub>max</sub>', 'nombre' => 'Flujo Máximo', 'valor' => number_format($Qmax, 3), 'unidad' => 'mL/s', 'semaforo' => $sem_Qmax, 'grupo' => 'flujos','explicacion' => 'Explic','explicacion_paciente' => 'textoP','rangos_normales' => 'rango'],
        'Qave' => ['nomenclatura' => 'Q<sub>ave</sub>', 'nombre' => 'Flujo Promedio', 'valor' => number_format($Qave, 3), 'unidad' => 'mL/s', 'semaforo' => $sem_Qmax, 'grupo' => 'flujos','explicacion' => 'Explic','explicacion_paciente' => 'textoP','rangos_normales' => 'rango'],
        't10' => ['nomenclatura' => 't<sub>10</sub>', 'nombre' => 'Tiempo al 10% de volumen', 'valor' => number_format($t10, 3), 'unidad' => 's', 'semaforo' => 'verde', 'grupo' => 'tiempos','explicacion' => 'Explic','explicacion_paciente' => 'textoP','rangos_normales' => 'rango'],
        't95' => ['nomenclatura' => 't<sub>95</sub>', 'nombre' => 'Tiempo al 95% de volumen', 'valor' => number_format($t95, 3), 'unidad' => 's', 'semaforo' => 'verde', 'grupo' => 'tiempos','explicacion' => 'Explic','explicacion_paciente' => 'textoP','rangos_normales' => 'rango'],
        'Q2' => ['nomenclatura' => 'Q<sub>2</sub>', 'nombre' => 'Flujo a los 2 segundos', 'valor' => number_format($q2, 3), 'unidad' => 'mL/s', 'semaforo' => 'verde', 'grupo' => 'flujos','explicacion' => 'Explic','explicacion_paciente' => 'textoP','rangos_normales' => 'rango'],
        'Vdrop' => ['nomenclatura' => 'V<sub>goteo</sub>', 'nombre' => 'Volumen de goteo final', 'valor' => number_format($Vdrop, 3), 'unidad' => 'mL', 'semaforo' => 'ambar', 'grupo' => 'volumenes','explicacion' => 'Explic','explicacion_paciente' => 'textoP','rangos_normales' => 'rango'],
        'Qgot' => ['nomenclatura' => 'Q<sub>goteo</sub>', 'nombre' => 'Flujo promedio de goteo', 'valor' => number_format($Qdrop, 3), 'unidad' => 'mL/s', 'semaforo' => 'ambar', 'grupo' => 'flujos','explicacion' => 'Explic','explicacion_paciente' => 'textoP','rangos_normales' => 'rango'],
        'SlewRate' => ['nomenclatura' => 'SR<sub>max</sub>', 'nombre' => 'Slew Rate Máx', 'valor' => number_format($SRmax, 3), 'unidad' => 'mL/s<sup>2</sup>', 'semaforo' => 'verde', 'grupo' => 'flujos','explicacion' => 'Explic','explicacion_paciente' => 'textoP','rangos_normales' => 'rango'],
        'AcelApertura' => ['nomenclatura' => 'a<sub>ap</sub>', 'nombre' => 'Aceleración de Apertura', 'valor' => number_format($acel_apertura, 3), 'unidad' => 'mL/s<sup>2</sup>', 'semaforo' => 'verde', 'grupo' => 'flujos','explicacion' => 'Explic','explicacion_paciente' => 'textoP','rangos_normales' => 'rango'],    
        'Decel' => ['nomenclatura' => 'Tasa<sub>decel</sub>', 'nombre' => 'Tasa de Deceleración', 'valor' => number_format($Tdesa, 3), 'unidad' => 'mL/s<sup>2</sup>', 'semaforo' => 'verde', 'grupo' => 'flujos','explicacion' => 'Explic','explicacion_paciente' => 'textoP','rangos_normales' => 'rango'],
        'Rhodarcy' => ['nomenclatura' => 'f<sub>Darcy</sub>', 'nombre' => 'Coeficiente de Darcy', 'valor' => number_format($f_darcy, 3), 'unidad' => '', 'semaforo' => 'verde', 'grupo' => 'fluidos','explicacion' => 'Explic','explicacion_paciente' => 'textoP','rangos_normales' => 'rango'],
        'Potdis' => ['nomenclatura' => 'P<sub>ot dis</sub>', 'nombre' => 'Pérdida por Disipación', 'valor' => number_format($pot_dis, 3), 'unidad' => 'mW', 'semaforo' => 'verde', 'grupo' => 'fluidos','explicacion' => 'Explic','explicacion_paciente' => 'textoP','rangos_normales' => 'rango'],
    	'Efric' => ['nomenclatura' => 'E<sub>fric</sub>', 'nombre' => 'Pérdida por Fricción', 'valor' => number_format($Efric, 3), 'unidad' => 'J/Kg', 'semaforo' => 'verde', 'grupo' => 'fluidos','explicacion' => 'Explic','explicacion_paciente' => 'textoP','rangos_normales' => 'rango'],
        'LinPURR' => ['nomenclatura' => 'LinPURR', 'nombre' => 'Índice de Schäfer', 'valor' => number_format($linPURR, 3), 'unidad' => '', 'semaforo' => $sem_linpur, 'grupo' => 'fluidos','explicacion' => 'Explic','explicacion_paciente' => 'textoP','rangos_normales' => 'rango'],
        'Vexit' => ['nomenclatura' => 'v<sub>exit</sub>', 'nombre' => 'Velocidad de Salida', 'valor' => number_format($Vexit, 3), 'unidad' => 'm/s', 'semaforo' => 'verde', 'grupo' => 'fluidos','explicacion' => 'Explic','explicacion_paciente' => 'textoP','rangos_normales' => 'rango'],
        'BWI' => ['nomenclatura' => 'BWI', 'nombre' => 'Índice de Trabajo Vesical', 'valor' => number_format($BWI, 3), 'unidad' => 'mL<sup>2</sup>/s', 'semaforo' => 'verde', 'grupo' => 'fluidos','explicacion' => 'Explic','explicacion_paciente' => 'textoP','rangos_normales' => 'rango'],
        'CIV' => ['nomenclatura' => 'CIV', 'nombre' => 'Coeficiente Variabilidad CIV', 'valor' => number_format($CVI, 2), 'unidad' => '%', 'semaforo' => 'verde', 'grupo' => 'flujos','explicacion' => 'Explic','explicacion_paciente' => 'textoP','rangos_normales' => 'rango'],
        'Ptot' => ['nomenclatura' => 'P<sub>tot</sub>', 'nombre' => 'Momentum Lineal Vesical', 'valor' => number_format($Ptot, 1), 'unidad' => 'g·m/s', 'semaforo' => 'verde', 'grupo' => 'fluidos','explicacion' => 'Explic','explicacion_paciente' => 'textoP','rangos_normales' => 'rango'],
        'Pothyd' => ['nomenclatura' => 'P<sub>ot hyd</sub>', 'nombre' => 'Potencia Hidráulica', 'valor' => number_format($Pothyd * 1000, 1), 'unidad' => 'mW', 'semaforo' => 'verde', 'grupo' => 'fluidos','explicacion' => 'Explic','explicacion_paciente' => 'textoP','rangos_normales' => 'rango'],
        'IRD' => ['nomenclatura' => 'IRD', 'nombre' => 'Reserva del Detrusor', 'valor' => number_format($IRD, 2), 'unidad' => '%', 'semaforo' => 'verde', 'grupo' => 'fluidos','explicacion' => 'Explic','explicacion_paciente' => 'textoP','rangos_normales' => 'rango'],
        'Venturi' => ['nomenclatura' => '&Delta;P<sub>Venturi</sub>', 'nombre' => 'Efecto Venturi Uretral', 'valor' => number_format($DPventuri, 3), 'unidad' => 'Pa', 'semaforo' => 'verde', 'grupo' => 'fluidos','explicacion' => 'Explic','explicacion_paciente' => 'textoP','rangos_normales' => 'rango'],
        'Remax' => ['nomenclatura' => 'Re<sub>max</sub>', 'nombre' => 'Número de Reynolds Máx', 'valor' => number_format($remax , 0), 'unidad' => '', 'semaforo' => 'verde', 'grupo' => 'fluidos','explicacion' => 'Explic','explicacion_paciente' => 'textoP','rangos_normales' => 'rango'],
        'EHV' => ['nomenclatura' => 'EHV', 'nombre' => 'Eficiencia Hidrodinámica', 'valor' => number_format($EHV, 3), 'unidad' => '%', 'semaforo' => 'verde', 'grupo' => 'fluidos','explicacion' => 'Explic','explicacion_paciente' => 'textoP','rangos_normales' => 'rango'],
        'Siroky' => ['nomenclatura' => 'Siroky<sub>score</sub>', 'nombre' => 'Nomograma de Siroky', 'valor' => number_format($siroky, 3), 'unidad' => '', 'semaforo' => $sem_siroky, 'grupo' => 'fluidos','explicacion' => 'Explic','explicacion_paciente' => 'textoP','rangos_normales' => 'rango']
    ];
    $respuesta[$id_miccion] = [
        'idMix'  => $num_miccion,
        'id' => $id_miccion,
        'fecha' => $fecha_completa,
        'secuencia' => substr($secuencia_cruda, 0, 150) . '... [Truncado en diagnóstico]',
        'tiempo_seg' => $tiempo_seg,
        'flujo_mls' => $flujo_mls,
        'volumen_acumulado' => $volumen_acumulado,
        'calculos' => $calculos,
        'dilatacion_ciclo' => $ciclo_asignado,
        'sonda_fr' => $sonda_fr_detectado,
        'es_apertura' => $es_miccion_apertura
    ];
    $num_miccion++;
}

echo json_encode($respuesta);
// finde archivo
