use printpdf::*;
use chrono::Utc;
use std::io::BufWriter;

use crate::models::{FermentationBatch, FermentationReading, BatchStats};

pub fn generate_batch_report(
    batch: &FermentationBatch,
    readings: &[FermentationReading],
    stats: &BatchStats,
    tank_name: &str,
) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    // Create PDF document
    let (doc, page1, layer1) = PdfDocument::new(
        "Fermentation Batch Report",
        Mm(210.0), // A4 width
        Mm(297.0), // A4 height
        "Layer 1",
    );

    // Get first page layer reference
    let mut current_layer = doc.get_page(page1).get_layer(layer1);

    // Load fonts
    let font = doc.add_builtin_font(BuiltinFont::Helvetica)?;
    let font_bold = doc.add_builtin_font(BuiltinFont::HelveticaBold)?;

    let mut y_position = 270.0;

    // Title
    current_layer.use_text(
        "FERMENTATION BATCH REPORT",
        32.0,
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

    // Batch Information
    current_layer.use_text(
        "BATCH INFORMATION",
        16.0,
        Mm(20.0),
        Mm(y_position),
        &font_bold,
    );
    y_position -= 8.0;

    draw_line(&current_layer, y_position);
    y_position -= 5.0;

    let info_items: Vec<(&str, String)> = vec![
        ("Batch Name:", batch.name.clone()),
        ("Grape Variety:", batch.grape_variety.clone()),
        ("Tank:", tank_name.to_string()),
        ("Volume:", format!("{} L", batch.volume_liters)),
        (
            "Target Temperature:",
            format!("{}°C", batch.target_temperature.unwrap_or(18.0)),
        ),
        (
            "Yeast Strain:",
            batch.yeast_strain.as_deref().unwrap_or("N/A").to_string(),
        ),
        (
            "Initial Brix:",
            batch
                .initial_brix
                .map(|b| format!("{}°", b))
                .unwrap_or_else(|| "N/A".to_string()),
        ),
        (
            "Initial pH:",
            batch
                .initial_ph
                .map(|p| format!("{:.2}", p))
                .unwrap_or_else(|| "N/A".to_string()),
        ),
        (
            "Start Date:",
            batch
                .start_date
                .map(|d| d.format("%Y-%m-%d").to_string())
                .unwrap_or_else(|| "N/A".to_string()),
        ),
        (
            "Expected End:",
            batch
                .expected_end_date
                .map(|d| d.format("%Y-%m-%d").to_string())
                .unwrap_or_else(|| "N/A".to_string()),
        ),
    ];

    for (label, value) in info_items {
        current_layer.use_text(label, 11.0, Mm(20.0), Mm(y_position), &font_bold);
        current_layer.use_text(&value, 11.0, Mm(80.0), Mm(y_position), &font);
        y_position -= 6.0;
    }

    if let Some(notes) = &batch.notes {
        y_position -= 3.0;
        current_layer.use_text("Notes:", 11.0, Mm(20.0), Mm(y_position), &font_bold);
        y_position -= 6.0;
        current_layer.use_text(notes, 10.0, Mm(20.0), Mm(y_position), &font);
        y_position -= 8.0;
    }

    y_position -= 10.0;

    // Statistics
    current_layer.use_text(
        "FERMENTATION STATISTICS",
        16.0,
        Mm(20.0),
        Mm(y_position),
        &font_bold,
    );
    y_position -= 8.0;

    draw_line(&current_layer, y_position);
    y_position -= 5.0;

    let stats_items = vec![
        ("Total Readings:", stats.total_readings.to_string()),
        (
            "Avg Temperature:",
            stats
                .avg_temperature
                .map(|t| format!("{:.1}°C", t))
                .unwrap_or_else(|| "N/A".to_string()),
        ),
        (
            "Min Temperature:",
            stats
                .min_temperature
                .map(|t| format!("{:.1}°C", t))
                .unwrap_or_else(|| "N/A".to_string()),
        ),
        (
            "Max Temperature:",
            stats
                .max_temperature
                .map(|t| format!("{:.1}°C", t))
                .unwrap_or_else(|| "N/A".to_string()),
        ),
        (
            "Latest Brix:",
            stats
                .latest_brix
                .map(|b| format!("{}°", b))
                .unwrap_or_else(|| "N/A".to_string()),
        ),
        (
            "Latest Alcohol:",
            stats
                .latest_alcohol
                .map(|a| format!("{:.1}%", a))
                .unwrap_or_else(|| "N/A".to_string()),
        ),
    ];

    for (label, value) in stats_items {
        current_layer.use_text(label, 11.0, Mm(20.0), Mm(y_position), &font_bold);
        current_layer.use_text(&value, 11.0, Mm(80.0), Mm(y_position), &font);
        y_position -= 6.0;
    }

    y_position -= 10.0;

    // Readings
    if !readings.is_empty() {
        current_layer.use_text(
            &format!("FERMENTATION READINGS ({})", readings.len()),
            16.0,
            Mm(20.0),
            Mm(y_position),
            &font_bold,
        );
        y_position -= 8.0;

        draw_line(&current_layer, y_position);
        y_position -= 5.0;

        for (i, reading) in readings.iter().enumerate() {
            // Check if we need a new page BEFORE starting to write
            if y_position < 40.0 {
                // Need new page
                let (page_num, layer_num) = doc.add_page(Mm(210.0), Mm(297.0), "Layer 1");
                current_layer = doc.get_page(page_num).get_layer(layer_num);
                y_position = 270.0; // Reset to top of new page
            }

            current_layer.use_text(
                &format!("Reading {}", i + 1),
                12.0,
                Mm(20.0),
                Mm(y_position),
                &font_bold,
            );
            y_position -= 6.0;

            let reading_header = format!(
                "{} - Source: {}",
                reading.recorded_at.format("%Y-%m-%d %H:%M"),
                reading.source
            );
            current_layer.use_text(&reading_header, 10.0, Mm(20.0), Mm(y_position), &font);
            y_position -= 6.0;

            let reading_items = vec![
                (
                    "Temperature:",
                    reading.temperature.map(|t| format!("{:.1}°C", t)),
                ),
                ("Brix:", reading.brix.map(|b| format!("{}°", b))),
                ("pH:", reading.ph.map(|p| format!("{:.2}", p))),
                (
                    "Density:",
                    reading.density.map(|d| format!("{:.4} g/mL", d)),
                ),
                (
                    "Alcohol:",
                    reading.alcohol_percent.map(|a| format!("{:.1}%", a)),
                ),
                (
                    "Volatile Acidity:",
                    reading.volatile_acidity.map(|v| format!("{:.2} g/L", v)),
                ),
                (
                    "Free SO2:",
                    reading.free_so2.map(|s| format!("{} mg/L", s)),
                ),
                (
                    "Total SO2:",
                    reading.total_so2.map(|s| format!("{} mg/L", s)),
                ),
                ("Color:", reading.color.clone()),
                ("Clarity:", reading.clarity.clone()),
                ("Aroma:", reading.aroma_notes.clone()),
            ];

            for (label, value) in reading_items {
                if let Some(val) = value {
                    // Check if we need new page within reading details
                    if y_position < 20.0 {
                        let (page_num, layer_num) = doc.add_page(Mm(210.0), Mm(297.0), "Layer 1");
                        current_layer = doc.get_page(page_num).get_layer(layer_num);
                        y_position = 270.0;
                    }

                    current_layer.use_text(label, 10.0, Mm(25.0), Mm(y_position), &font_bold);
                    current_layer.use_text(&val, 10.0, Mm(75.0), Mm(y_position), &font);
                    y_position -= 5.0;
                }
            }

            if let Some(notes) = &reading.notes {
                if y_position < 20.0 {
                    let (page_num, layer_num) = doc.add_page(Mm(210.0), Mm(297.0), "Layer 1");
                    current_layer = doc.get_page(page_num).get_layer(layer_num);
                    y_position = 270.0;
                }

                current_layer.use_text("Notes:", 10.0, Mm(25.0), Mm(y_position), &font_bold);
                y_position -= 5.0;
                current_layer.use_text(notes, 9.0, Mm(25.0), Mm(y_position), &font);
                y_position -= 5.0;
            }

            y_position -= 5.0; // Space between readings
        }
    } else {
        current_layer.use_text(
            "No readings recorded",
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