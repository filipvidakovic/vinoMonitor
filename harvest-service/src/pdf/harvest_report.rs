use printpdf::*;
use chrono::Utc;
use std::io::BufWriter;

use crate::models::harvest::{Harvest, HarvestQuality};

pub fn generate_harvest_report(
    harvest: &Harvest,
    quality_measurements: &[HarvestQuality],
    vineyard_name: &str,
    parcel_name: &str,
) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    // Create PDF document
    let (doc, page1, layer1) = PdfDocument::new(
        "Harvest Report",
        Mm(210.0), // A4 width
        Mm(297.0), // A4 height
        "Layer 1",
    );

    let current_layer = doc.get_page(page1).get_layer(layer1);

    // Load fonts
    let font = doc.add_builtin_font(BuiltinFont::Helvetica)?;
    let font_bold = doc.add_builtin_font(BuiltinFont::HelveticaBold)?;

    let mut y_position = 270.0; // Start from top

    // Title
    current_layer.use_text(
        "HARVEST REPORT",
        36.0,
        Mm(20.0),
        Mm(y_position),
        &font_bold,
    );
    y_position -= 15.0;

    // Date
    current_layer.use_text(
        &format!("Generated: {}", Utc::now().format("%Y-%m-%d %H:%M")),
        10.0,
        Mm(20.0),
        Mm(y_position),
        &font,
    );
    y_position -= 20.0;

    // Harvest Information
    current_layer.use_text(
        "HARVEST INFORMATION",
        16.0,
        Mm(20.0),
        Mm(y_position),
        &font_bold,
    );
    y_position -= 8.0;

    draw_line(&current_layer, y_position);
    y_position -= 5.0;

    let info_items: Vec<(&str, String)> = vec![
        ("Vineyard:", String::from(vineyard_name)),
        ("Parcel:", String::from(parcel_name)),
        ("Harvest Date:", harvest.harvest_date.format("%Y-%m-%d").to_string()),
        (
            "Total Weight:",
            format!("{} kg", harvest.total_weight_kg.unwrap_or(0.0)),
        ),
        (
            "Yield per Hectare:",
            format!("{} kg/ha", harvest.yield_per_hectare.unwrap_or(0.0)),
        ),
        (
            "Weather:",
            String::from(harvest.weather_condition.as_deref().unwrap_or("N/A")),
        ),
        (
            "Temperature:",
            format!(
                "{}°C",
                harvest
                    .temperature_celsius
                    .map(|t| t.to_string())
                    .unwrap_or_else(|| "N/A".to_string())
            ),
        ),
        (
            "Humidity:",
            format!(
                "{}%",
                harvest
                    .humidity_percent
                    .map(|h| h.to_string())
                    .unwrap_or_else(|| "N/A".to_string())
            ),
        ),
        ("Status:", harvest.status.to_string()),
    ];

    for (label, value) in info_items {
        current_layer.use_text(label, 11.0, Mm(20.0), Mm(y_position), &font_bold);
        current_layer.use_text(value, 11.0, Mm(70.0), Mm(y_position), &font);
        y_position -= 6.0;
    }

    if let Some(notes) = &harvest.notes {
        y_position -= 3.0;
        current_layer.use_text("Notes:", 11.0, Mm(20.0), Mm(y_position), &font_bold);
        y_position -= 6.0;
        current_layer.use_text(notes, 10.0, Mm(20.0), Mm(y_position), &font);
        y_position -= 8.0;
    }

    y_position -= 10.0;

    // Quality Measurements
    if !quality_measurements.is_empty() {
        current_layer.use_text(
            "QUALITY MEASUREMENTS",
            16.0,
            Mm(20.0),
            Mm(y_position),
            &font_bold,
        );
        y_position -= 8.0;

        draw_line(&current_layer, y_position);
        y_position -= 5.0;

        for (i, measurement) in quality_measurements.iter().enumerate() {
            if y_position < 30.0 {
                // Need new page
                let (page_num, layer_num) = doc.add_page(Mm(210.0), Mm(297.0), "Layer 1");
                let current_layer = doc.get_page(page_num).get_layer(layer_num);
                y_position = 270.0;
            }

            current_layer.use_text(
                &format!("Measurement {}", i + 1),
                12.0,
                Mm(20.0),
                Mm(y_position),
                &font_bold,
            );
            y_position -= 6.0;

            current_layer.use_text(
                &format!(
                    "Date: {}",
                    measurement.measured_at.format("%Y-%m-%d %H:%M")
                ),
                10.0,
                Mm(20.0),
                Mm(y_position),
                &font,
            );
            y_position -= 6.0;

            let measurement_items = vec![
                ("Brix:", measurement.brix.map(|v| format!("{}°", v))),
                ("pH:", measurement.ph.map(|v| format!("{:.2}", v))),
                (
                    "Acidity:",
                    measurement.acidity.map(|v| format!("{} g/L", v)),
                ),
                (
                    "Berry Size:",
                    measurement.berry_size.clone(),
                ),
                (
                    "Berry Color:",
                    measurement.berry_color.clone(),
                ),
                (
                    "Grape Health:",
                    measurement.grape_health.clone(),
                ),
            ];

            for (label, value) in measurement_items {
                if let Some(val) = value {
                    current_layer.use_text(label, 10.0, Mm(25.0), Mm(y_position), &font_bold);
                    current_layer.use_text(&val, 10.0, Mm(65.0), Mm(y_position), &font);
                    y_position -= 5.0;
                }
            }

            if let Some(notes) = &measurement.notes {
                current_layer.use_text("Notes:", 10.0, Mm(25.0), Mm(y_position), &font_bold);
                y_position -= 5.0;
                current_layer.use_text(notes, 9.0, Mm(25.0), Mm(y_position), &font);
                y_position -= 5.0;
            }

            y_position -= 5.0;
        }
    } else {
        current_layer.use_text(
            "No quality measurements recorded",
            11.0,
            Mm(20.0),
            Mm(y_position),
            &font,
        );
    }

    // Save to buffer
    let mut buffer = Vec::new();
    doc.save(&mut BufWriter::new(&mut buffer))?;

    Ok(buffer)
}

fn draw_line(layer: &PdfLayerReference, y_mm: f32) {
    use printpdf::PdfLayerReference;

    let points = vec![
        (Point::new(Mm(20.0), Mm(y_mm)), false),
        (Point::new(Mm(190.0), Mm(y_mm)), false),
    ];

    let line = Line {
        points,
        is_closed: false,
    };

    layer.set_outline_thickness(0.5);
    layer.add_line(line);
}