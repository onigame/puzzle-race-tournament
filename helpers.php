<?php
function generateBreadcrumbs(array $items): string {
    $html = '<nav class="breadcrumbs"><ul>';
    $itemCount = count($items);
    
    foreach ($items as $index => $item) {
        $html .= '<li>';
        if ($index < $itemCount - 1) {
            // Not the last item, so it's a link
            $html .= '<a href="' . htmlspecialchars($item['url']) . '">' . htmlspecialchars($item['label']) . '</a>';
        } else {
            // The last item, just text
            $html .= '<span>' . htmlspecialchars($item['label']) . '</span>';
        }
        $html .= '</li>';
    }
    
    $html .= '</ul></nav>';
    return $html;
}
?>