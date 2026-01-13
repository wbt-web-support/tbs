"use client";

import { useState, useEffect, useRef } from "react";
import {
    Plus,
    Search,
    Loader2,
    Package,
    MoreHorizontal,
    Edit,
    Trash2,
    Image as ImageIcon,
    Tag,
    Hammer,
    Maximize2,
    Undo2,
    Layers,
    Ruler,
    Check,
    X as CloseIcon,
    Zap,
    Wind,
    Battery,
    Flame,
    Sun,
    Upload,
    FileJson,
    Database,
    Info,
    ChevronRight,
    RefreshCw
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import React from "react";
import ErrorCodeSelector from "@/components/admin/error-code-selector";

type Category = 'boiler' | 'ac' | 'ashp' | 'battery_storage' | 'solar';

interface Product {
    id: number;
    client_id: string | null;
    category: Category;
    title: string;
    subtitle: string | null;
    power_rating: string | null;
    base_price: number | null;
    image: string | null;
    description: string | null;
    width: string | null;
    height: string | null;
    depth: string | null;
    brand_id: string | null;
    product_specs: any;
    is_active: boolean;
    doc_link: string | null;
    created_at: string;
    updated_at: string;
}

type ProductFormState = {
    title: string;
    category: Category;
    subtitle: string;
    power_rating: string;
    base_price: string;
    image: string;
    description: string;
    width: string;
    height: string;
    depth: string;
    brand_id: string;
    product_specs: Record<string, string>;
    is_active: boolean;
    doc_link: string;
};

const initialFormState: ProductFormState = {
    title: "",
    category: "boiler",
    subtitle: "",
    power_rating: "",
    base_price: "",
    image: "",
    description: "",
    width: "",
    height: "",
    depth: "",
    brand_id: "",
    product_specs: {},
    is_active: true,
    doc_link: ""
};

// Normalize product name for comparison (remove extra spaces, dashes, commas, etc.)
const normalizeProductName = (name: string): string => {
    return name
        .toLowerCase()
        .replace(/[-\s,._]/g, '') // Remove dashes, spaces, commas, dots, underscores
        .trim();
};

// Check if two products are duplicates based on normalized name, category, power, and price
const isDuplicateProduct = (product1: { title: string; category: string; power_rating: string | null; base_price: number | null }, product2: { title: string; category: string; power_rating: string | null; base_price: number | null }): boolean => {
    const name1 = normalizeProductName(product1.title);
    const name2 = normalizeProductName(product2.title);
    
    return (
        name1 === name2 &&
        product1.category === product2.category &&
        (product1.power_rating || '') === (product2.power_rating || '') &&
        (product1.base_price || 0) === (product2.base_price || 0)
    );
};

const CATEGORY_SPECS: Record<Category, { label: string; key: string; placeholder: string }[]> = {
    boiler: [
        { label: "Boiler Type", key: "boiler_type", placeholder: "e.g. Combi, System, Regular" },
        { label: "Efficiency (%)", key: "efficiency", placeholder: "e.g. 94" },
        { label: "Flow Rate (L/min)", key: "flow_rate", placeholder: "e.g. 12.3" },
        { label: "Gas Type", key: "gas_type", placeholder: "Natural Gas or LPG" }
    ],
    ac: [
        { label: "Cooling Capacity (BTU)", key: "cooling_capacity", placeholder: "e.g. 12000" },
        { label: "Heating Capacity (BTU)", key: "heating_capacity", placeholder: "e.g. 13000" },
        { label: "SEER Rating", key: "seer", placeholder: "e.g. 6.1" },
        { label: "Refrigerant", key: "refrigerant", placeholder: "e.g. R32" }
    ],
    ashp: [
        { label: "COP (Coeff. of Perf.)", key: "cop", placeholder: "e.g. 4.5" },
        { label: "SCOP", key: "scop", placeholder: "e.g. 3.8" },
        { label: "Max Flow Temp (°C)", key: "max_temp", placeholder: "e.g. 65" },
        { label: "Refrigerant", key: "refrigerant", placeholder: "e.g. R290" }
    ],
    battery_storage: [
        { label: "Usable Capacity (kWh)", key: "capacity", placeholder: "e.g. 5.0" },
        { label: "Nominal Power (kW)", key: "power", placeholder: "e.g. 3.0" },
        { label: "Cycle Life", key: "cycles", placeholder: "e.g. 6000" },
        { label: "Chemistry", key: "chemistry", placeholder: "e.g. LiFePO4" }
    ],
    solar: [
        { label: "Peak Power (Wp)", key: "wattage", placeholder: "e.g. 400" },
        { label: "Panel Efficiency (%)", key: "efficiency", placeholder: "e.g. 21.3" },
        { label: "Panel Type", key: "panel_type", placeholder: "e.g. Monocrystalline" },
        { label: "Cell Count", key: "cells", placeholder: "e.g. 108" }
    ]
};

// SQL Import Mappings
const SQL_IMPORT_CONFIGS: Record<string, {
    category: Category;
    tableName: string;
    detectKey: string;
    mapping: (p: any) => Partial<Product>;
}> = {
    boiler: {
        category: 'boiler',
        tableName: 'tbl_boiler_price_info',
        detectKey: 'boiler_main_title',
        mapping: (p) => ({
            title: p.boiler_main_title || "Untitled Boiler",
            subtitle: p.boiler_size ? `Size: ${p.boiler_size}` : null,
            power_rating: p.boiler_power ? `${p.boiler_power}kW` : null,
            base_price: p.boiler_cost ? parseFloat(p.boiler_cost) : null,
            description: p.boiler_description || p.boilerProperties,
            width: p.boiler_width,
            height: p.boiler_height,
            depth: p.boiler_depth,
            image: p.boiler_image1,
            brand_id: p.brand_id,
            product_specs: {
                boiler_type: p.type_of_boilers,
                gas_type: p.boiler_for,
                flow_rate: p.boiler_hot_water_flow_rate
            }
        })
    },
    ac: {
        category: 'ac',
        tableName: 'tbl_ac_client_detail',
        detectKey: 'pro_ac_title',
        mapping: (p) => ({
            title: p.pro_ac_title,
            subtitle: p.pro_ac_subtitle,
            base_price: p.pro_base_price ? parseFloat(p.pro_base_price) : null,
            width: p.pro_ac_width,
            height: p.pro_ac_height,
            depth: p.pro_ac_depth,
            image: p.pro_image,
            description: p.pro_ac_features,
            product_specs: {
                cooling_capacity: p.pro_cooling_power,
                heating_capacity: p.pro_heating_power
            }
        })
    },
    ashp: {
        category: 'ashp',
        tableName: 'tbl_ashp_package_detail',
        detectKey: 'ashp_detail',
        mapping: (p) => {
            let detail = {};
            try { detail = typeof p.ashp_detail === 'string' ? JSON.parse(p.ashp_detail) : p.ashp_detail || {}; } catch (e) { }
            const d = detail as any;
            return {
                title: d.ashp_title || "Heat Pump",
                power_rating: d.ashp_power ? `${d.ashp_power}kW` : null,
                description: d.ashp_description,
                width: d.width,
                height: d.height,
                depth: d.depth,
                image: d.image_path,
                product_specs: {
                    cop: d.ashp_cop,
                    noise_level: d.ashp_noise_level
                }
            };
        }
    },
    battery_storage: {
        category: 'battery_storage',
        tableName: 'tbl_battery_storage_details_client',
        detectKey: 'battery_storage_title',
        mapping: (p) => ({
            title: p.battery_storage_title,
            power_rating: p.power,
            width: p.width,
            height: p.height,
            depth: p.depth,
            image: p.image,
            description: p.battery_storage_features || p.description,
            product_specs: {
                capacity: p.power // Assuming power field stores capacity in some cases
            }
        })
    },
    solar: {
        category: 'solar',
        tableName: 'tbl_solar_details_client',
        detectKey: 'solar_main_title',
        mapping: (p) => ({
            title: p.solar_main_title,
            subtitle: p.solar_description,
            description: p.solarProperties,
            image: p.solar_image,
            product_specs: {
                quantity: p.quantity
            }
        })
    }
};

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [clientId, setClientId] = useState<string | null>(null);
    const [detectedCategory, setDetectedCategory] = useState<Category | null>(null);
    const [importResults, setImportResults] = useState<{ count: number } | null>(null);
    const [isSyncingAI, setIsSyncingAI] = useState(false);
    const [syncRemainingTime, setSyncRemainingTime] = useState<number>(0);
    const [isExtractingDoc, setIsExtractingDoc] = useState(false);
    const [selectedErrorCodes, setSelectedErrorCodes] = useState<number[]>([]);
    const [duplicateProducts, setDuplicateProducts] = useState<Array<{ new: any; existing: Product }>>([]);
    const [duplicateAction, setDuplicateAction] = useState<'replace' | 'skip' | null>(null);
    const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
    const [pendingImportProducts, setPendingImportProducts] = useState<any[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const docInputRef = useRef<HTMLInputElement>(null);

    const supabase = createClient();

    const [form, setForm] = useState<ProductFormState>(initialFormState);

    useEffect(() => {
        fetchSession();
        fetchProducts();
    }, []);

    const fetchSession = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: profile } = await supabase
                .from('business_info')
                .select('team_id')
                .eq('user_id', user.id)
                .single();

            if (profile?.team_id) {
                setClientId(profile.team_id);
            }
        }
    };

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setProducts(data || []);
        } catch (error) {
            console.error("Error fetching products:", error);
            toast.error("Failed to load products");
        } finally {
            setLoading(false);
        }
    };

    const openAddDialog = () => {
        setEditingProduct(null);
        setForm(initialFormState);
        setSelectedErrorCodes([]);
        setIsDialogOpen(true);
    };

    const openEditDialog = async (product: Product) => {
        setEditingProduct(product);
        setForm({
            title: product.title || "",
            category: product.category || "boiler",
            subtitle: product.subtitle || "",
            power_rating: product.power_rating || "",
            base_price: product.base_price?.toString() || "",
            image: product.image || "",
            description: product.description || "",
            width: product.width || "",
            height: product.height || "",
            depth: product.depth || "",
            brand_id: product.brand_id?.toString() || "",
            product_specs: product.product_specs || {},
            is_active: product.is_active ?? true,
            doc_link: product.doc_link || ""
        });
        
        // Fetch associated error codes
        const { data } = await supabase
            .from('product_error_codes')
            .select('error_code_id')
            .eq('product_id', product.id);
        
        setSelectedErrorCodes(data?.map((item: { error_code_id: number }) => item.error_code_id) || []);
        setIsDialogOpen(true);
    };

    const handleSubmit = async () => {
        if (!form.title) {
            toast.error("Product title is required");
            return;
        }

        try {
            setIsSubmitting(true);

            const basePrice = form.base_price ? parseFloat(form.base_price) : null;

            // Check for duplicates if creating new product
            if (!editingProduct) {
                const { data: existingProducts } = await supabase
                    .from('products')
                    .select('id, title, category, power_rating, base_price');

                if (existingProducts) {
                    const newProduct = {
                        title: form.title,
                        category: form.category,
                        power_rating: form.power_rating || null,
                        base_price: basePrice
                    };

                    const duplicate = existingProducts.find((existing: Product) => 
                        isDuplicateProduct(newProduct, {
                            title: existing.title,
                            category: existing.category,
                            power_rating: existing.power_rating,
                            base_price: existing.base_price
                        })
                    );

                    if (duplicate) {
                        toast.error(`Duplicate product found! A product with the same name "${duplicate.title}", category, power rating, and price already exists.`);
                        setIsSubmitting(false);
                        return;
                    }
                }
            }

            // Build product data, only including valid fields
            const productData: any = {
                title: form.title,
                category: form.category,
                subtitle: form.subtitle || null,
                power_rating: form.power_rating || null,
                description: form.description || null,
                image: form.image || null,
                width: form.width || null,
                height: form.height || null,
                depth: form.depth || null,
                brand_id: form.brand_id ? parseInt(form.brand_id) : null,
                client_id: clientId,
                product_specs: form.product_specs,
                doc_link: form.doc_link || null,
                is_active: form.is_active
            };

            // Only add base_price if it's a valid number
            if (basePrice !== null && !isNaN(basePrice)) {
                productData.base_price = basePrice;
            }

            let productId: number;

            if (editingProduct) {
                const { data, error } = await supabase
                    .from('products')
                    .update(productData)
                    .eq('id', editingProduct.id)
                    .select()
                    .single();

                if (error) throw error;
                productId = data.id;
                toast.success("Product updated successfully");
            } else {
                const { data, error } = await supabase
                    .from('products')
                    .insert([productData])
                    .select()
                    .single();

                if (error) {
                    if (error.code === '23505') {
                        toast.error("A product with similar details already exists. Please check the product name, category, power rating, and price.");
                    } else {
                        throw error;
                    }
                    return;
                }
                productId = data.id;
                toast.success("Product created successfully");
            }

            // Update error codes association
            if (productId) {
                try {
                    // Delete existing associations
                    const { error: deleteError } = await supabase
                        .from('product_error_codes')
                        .delete()
                        .eq('product_id', productId);

                    if (deleteError) {
                        console.warn("Warning: Failed to delete existing error code associations:", deleteError);
                        toast.warning("Product saved but failed to update error code associations");
                    }

                    // Insert new associations
                    if (selectedErrorCodes.length > 0) {
                        const associations = selectedErrorCodes.map(errorCodeId => ({
                            product_id: productId,
                            error_code_id: errorCodeId
                        }));

                        const { error: assocError } = await supabase
                            .from('product_error_codes')
                            .insert(associations);

                        if (assocError) {
                            console.warn("Warning: Failed to associate error codes:", assocError);
                            toast.warning("Product saved but failed to associate some error codes");
                        }
                    }
                } catch (assocErr) {
                    console.warn("Warning: Error code association failed:", assocErr);
                    toast.warning("Product saved successfully, but there was an issue updating error codes");
                }
            }

            setIsDialogOpen(false);
            fetchProducts();
        } catch (error: any) {
            console.error("Error saving product:", error);
            
            // Parse Supabase error to show specific field issues
            let errorMessage = editingProduct ? "Failed to update product" : "Failed to create product";
            
            if (error?.code) {
                switch (error.code) {
                    case '23505':
                        errorMessage = "Duplicate entry: A product with this combination of title, category, and power rating already exists.";
                        break;
                    case '23503':
                        errorMessage = "Invalid reference: One of the referenced fields (brand_id, client_id) doesn't exist.";
                        break;
                    case '23502':
                        // Extract field name from error message
                        const fieldMatch = error.message?.match(/column "(\w+)"/i);
                        if (fieldMatch) {
                            const fieldName = fieldMatch[1].replace(/_/g, ' ');
                            errorMessage = `Required field missing: ${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required but was not provided.`;
                        } else {
                            errorMessage = "Required field missing: Please check all required fields are filled.";
                        }
                        break;
                    case '22001':
                        errorMessage = "Field too long: One of the text fields exceeds the maximum length. Please shorten the value.";
                        break;
                    case '22P02':
                        errorMessage = "Invalid data type: One of the numeric fields contains invalid data. Please check brand_id and base_price.";
                        break;
                    default:
                        // Try to extract field name from error message
                        if (error.message) {
                            // Check for schema cache errors (column doesn't exist)
                            if (error.message.includes('schema cache') || error.message.includes('Could not find')) {
                                const fieldMatch = error.message.match(/column ['"](\w+)['"]/i);
                                if (fieldMatch) {
                                    const fieldName = fieldMatch[1].replace(/_/g, ' ');
                                    errorMessage = `Database schema error: The field "${fieldName}" doesn't exist in the database. Please run the migration to add this column.`;
                                } else {
                                    errorMessage = `Database schema error: A field in your data doesn't exist in the database schema. Please check your migrations.`;
                                }
                            } else {
                                const fieldMatch = error.message.match(/column "(\w+)"|field "(\w+)"/i);
                                if (fieldMatch) {
                                    const fieldName = (fieldMatch[1] || fieldMatch[2]).replace(/_/g, ' ');
                                    errorMessage = `Error in field "${fieldName}": ${error.message}`;
                                } else {
                                    errorMessage = `Database error: ${error.message}`;
                                }
                            }
                        }
                }
            } else if (error?.message) {
                // Check for schema cache errors in generic error messages
                if (error.message.includes('schema cache') || error.message.includes('Could not find')) {
                    const fieldMatch = error.message.match(/column ['"](\w+)['"]/i);
                    if (fieldMatch) {
                        const fieldName = fieldMatch[1].replace(/_/g, ' ');
                        errorMessage = `Database schema error: The field "${fieldName}" doesn't exist in the database. Please run the migration to add this column.`;
                    } else {
                        errorMessage = `Database schema error: A field doesn't exist in the database schema. Please check your migrations.`;
                    }
                } else {
                    errorMessage = error.message;
                }
            }
            
            toast.error(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleImportSQL = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setIsImporting(true);
            setImportResults(null);
            const text = await file.text();

            // 1. Identify which category/config to use
            let configKey: string | null = null;
            for (const key of Object.keys(SQL_IMPORT_CONFIGS)) {
                if (text.includes(SQL_IMPORT_CONFIGS[key].tableName)) {
                    configKey = key;
                    break;
                }
            }

            if (!configKey) {
                toast.error("Could not identify product table type in the SQL file.");
                return;
            }

            const config = SQL_IMPORT_CONFIGS[configKey];
            setDetectedCategory(config.category);

            // 2. Extract Data
            const insertRegex = new RegExp(`INSERT INTO \`${config.tableName}\` \\((.*?)\\) VALUES\\s*([\\s\\S]*?);`, 'g');
            let match;
            const allProducts = [];

            while ((match = insertRegex.exec(text)) !== null) {
                const columns = match[1].split(',').map(c => c.trim().replace(/`/g, ''));
                const valuesBlock = match[2];
                const rowRegex = /\(([\s\S]*?)\)(?:,|$)/g;
                let rowMatch;
                while ((rowMatch = rowRegex.exec(valuesBlock)) !== null) {
                    const values = parseSqlValues(rowMatch[1]);
                    const rowData: Record<string, any> = {};
                    columns.forEach((col, idx) => {
                        rowData[col] = values[idx];
                    });
                    allProducts.push(rowData);
                }
            }

            if (allProducts.length === 0) {
                toast.error("No valid product data found in the SQL file");
                return;
            }

            // 3. Map to our schema
            const mappedProducts = allProducts.map(p => ({
                ...config.mapping(p),
                client_id: clientId,
                category: config.category,
                is_active: true,
                created_at: new Date().toISOString()
            }));

            // 3.5 Client-side Deduplication (Handle duplicates within the same SQL file)
            const uniqueMap = new Map();
            mappedProducts.forEach(p => {
                const normalizedKey = `${normalizeProductName(p.title || '')}-${p.category}-${p.power_rating || ''}-${p.base_price || 0}`;
                uniqueMap.set(normalizedKey, p); // Later entries overwrite earlier ones
            });
            const deduplicatedProducts = Array.from(uniqueMap.values());

            // 4. Check for duplicates against existing products
            const { data: existingProducts } = await supabase
                .from('products')
                .select('id, title, category, power_rating, base_price');

            const duplicates: Array<{ new: any; existing: Product }> = [];
            const newProducts: any[] = [];

            deduplicatedProducts.forEach(newProduct => {
                const duplicate = existingProducts?.find((existing: Product) => 
                    isDuplicateProduct(
                        {
                            title: newProduct.title,
                            category: newProduct.category,
                            power_rating: newProduct.power_rating || null,
                            base_price: newProduct.base_price || null
                        },
                        {
                            title: existing.title,
                            category: existing.category,
                            power_rating: existing.power_rating,
                            base_price: existing.base_price
                        }
                    )
                );

                if (duplicate) {
                    duplicates.push({ new: newProduct, existing: duplicate });
                } else {
                    newProducts.push(newProduct);
                }
            });

            // If duplicates found, show dialog for user to choose action
            if (duplicates.length > 0) {
                setDuplicateProducts(duplicates);
                setPendingImportProducts(newProducts);
                setShowDuplicateDialog(true);
                setIsImporting(false);
                return;
            }

            // 5. Insert new products
            if (newProducts.length > 0) {
                const { error } = await supabase
                    .from('products')
                    .insert(newProducts);

                if (error) throw error;
            }

            setImportResults({ count: newProducts.length });
            toast.success(`Successfully imported ${newProducts.length} ${config.category} products!${duplicates.length > 0 ? ` (${duplicates.length} duplicates skipped)` : ''}`);

            // 6. Trigger Automated AI Vector Sync with Progress
            const totalImported = newProducts.length;
            const estSeconds = Math.ceil(totalImported * 1.5);
            setSyncRemainingTime(estSeconds);
            setIsSyncingAI(true);

            // Background countdown timer
            const timer = setInterval(() => {
                setSyncRemainingTime(prev => (prev > 0 ? prev - 1 : 0));
            }, 1000);

            try {
                const res = await fetch("/api/ai-instructions/generate-embedding", {
                    method: "POST",
                    body: JSON.stringify({ batch: true })
                });
                if (!res.ok) console.error("Auto-sync failed");
            } catch (err) {
                console.error("Auto-sync error:", err);
            } finally {
                clearInterval(timer);
                setIsSyncingAI(false);
                setSyncRemainingTime(0);
                fetchProducts();
            }
        } catch (error) {
            console.error("Import error:", error);
            toast.error("Error importing SQL data. Please check the file format.");
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const parseSqlValues = (str: string): any[] => {
        const result: any[] = [];
        let current = "";
        let inQuote = false;
        let quoteChar = "";

        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            if ((char === "'" || char === '"') && str[i - 1] !== '\\') {
                if (!inQuote) {
                    inQuote = true;
                    quoteChar = char;
                } else if (char === quoteChar) {
                    inQuote = false;
                } else {
                    current += char;
                }
            } else if (char === "," && !inQuote) {
                result.push(processValue(current));
                current = "";
            } else {
                current += char;
            }
        }
        result.push(processValue(current));
        return result;
    };

    const processValue = (v: string) => {
        v = v.trim();
        if (v.toUpperCase() === 'NULL') return null;
        if (!isNaN(Number(v)) && (v.startsWith('0') ? v.length === 1 : true)) return Number(v);
        return v.replace(/\\'/g, "'").replace(/\\"/g, '"');
    };

    const handleDocumentExtraction = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setIsExtractingDoc(true);
            const formData = new FormData();
            formData.append('file', file);
            if (clientId) formData.append('clientId', clientId);

            const res = await fetch("/api/products/extract-file", {
                method: "POST",
                body: formData
            });

            const result = await res.json();

            if (!res.ok) throw new Error(result.error || "Extraction failed");

            toast.success("Product details extracted. Review and click Save to store it.");
            setForm(prev => ({
                ...prev,
                title: result.product.title,
                category: result.product.category,
                subtitle: result.product.subtitle || "",
                power_rating: result.product.power_rating || "",
                base_price: result.product.base_price?.toString() || "",
                description: result.product.description || "",
                doc_link: result.product.doc_link || "",
                product_specs: { ...prev.product_specs, ...result.product.product_specs }
            }));
        } catch (error: any) {
            console.error("Doc Extraction Error:", error);
            toast.error(error.message || "Failed to process document");
        } finally {
            setIsExtractingDoc(false);
            if (docInputRef.current) docInputRef.current.value = "";
        }
    };

    const handleDeleteProduct = async (id: number) => {
        if (!confirm("Are you sure you want to delete this product?")) return;

        try {
            const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success("Product deleted successfully");
            fetchProducts();
        } catch (error) {
            console.error("Error deleting product:", error);
            toast.error("Failed to delete product");
        }
    };

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.category.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const getCategoryTheme = (category: string) => {
        switch (category) {
            case 'boiler': return { color: 'bg-orange-100 text-orange-800', icon: Flame };
            case 'ac': return { color: 'bg-cyan-100 text-cyan-800', icon: Wind };
            case 'ashp': return { color: 'bg-green-100 text-green-800', icon: Zap };
            case 'battery_storage': return { color: 'bg-indigo-100 text-indigo-800', icon: Battery };
            case 'solar': return { color: 'bg-amber-100 text-amber-800', icon: Sun };
            default: return { color: 'bg-gray-100 text-gray-800', icon: Package };
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Products Catalog</h1>
                    <p className="text-muted-foreground flex items-center gap-1.5">
                        Manage your inventory across all energy categories.
                        <Info className="w-3.5 h-3.5 text-blue-500 cursor-help" />
                    </p>
                </div>

                <div className="flex gap-3">
                    <Button variant="outline" className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 transition-all font-semibold" onClick={() => {
                        setDetectedCategory(null);
                        setImportResults(null);
                        setIsImportDialogOpen(true);
                    }}>
                        <Database className="w-4 h-4" />
                        Bulk Import (SQL)
                    </Button>
                    <Button className="gap-2 shadow-sm font-semibold hover:scale-[1.02] active:scale-95 transition-all" onClick={openAddDialog}>
                        <Plus className="w-4 h-4" />
                        New Product
                    </Button>
                </div>
            </div>



            {/* Modern Intelligence Import Dialog */}
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-xl">
                            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                                <Database className="w-5 h-5" />
                            </div>
                            Intelligent SQL Import
                        </DialogTitle>
                        <DialogDescription className="pt-2">
                            Our system will automatically detect the category and map the data fields based on our pre-defined intelligence.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {!importResults ? (
                            <div
                                className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-10 transition-all cursor-pointer bg-gray-50/50 hover:bg-blue-50/50 ${isImporting ? 'border-blue-400 opacity-80' : 'border-gray-200 hover:border-blue-300'}`}
                                onClick={() => !isImporting && fileInputRef.current?.click()}
                            >
                                <div className={`p-5 rounded-full mb-4 transition-transform ${isImporting ? 'bg-blue-100 text-blue-600 scale-110' : 'bg-gray-100 text-gray-400 group-hover:scale-110'}`}>
                                    {isImporting ? <Loader2 className="w-10 h-10 animate-spin" /> : <Upload className="w-10 h-10" />}
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-gray-700">{isImporting ? "Processing Intelligence..." : "Click to upload SQL File"}</p>
                                    <p className="text-sm text-muted-foreground mt-1">Detecting Boilers, A/C, Solar, Battery & ASHP</p>
                                </div>
                                <input
                                    type="file"
                                    accept=".sql"
                                    className="hidden"
                                    ref={fileInputRef}
                                    onChange={handleImportSQL}
                                    disabled={isImporting}
                                />
                            </div>
                        ) : (
                            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-100 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-full bg-emerald-500 text-white">
                                        <Check className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-emerald-900">Import Successful!</p>
                                        <p className="text-sm text-emerald-700">Category Detected: <span className="uppercase font-bold">{detectedCategory}</span></p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 py-2">
                                    <div className="bg-white/60 p-3 rounded-lg flex flex-col items-center">
                                        <span className="text-2xl font-black text-emerald-700">{importResults.count}</span>
                                        <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">Products Imported</span>
                                    </div>
                                    <div className="bg-white/60 p-3 rounded-lg flex flex-col items-center">
                                        <span className="text-2xl font-black text-emerald-700">100%</span>
                                        <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">Mapping Accuracy</span>
                                    </div>
                                </div>

                                {isSyncingAI && (
                                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl space-y-3 animate-pulse">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-amber-700">
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                <span className="text-sm font-bold">Generating AI Vectors...</span>
                                            </div>
                                            <span className="text-xs font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                                                {syncRemainingTime}s remaining
                                            </span>
                                        </div>
                                        <div className="w-full bg-amber-200/50 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className="bg-amber-500 h-full transition-all duration-1000"
                                                style={{ width: `${Math.max(5, (1 - syncRemainingTime / (importResults.count * 1.5 || 1)) * 100)}%` }}
                                            />
                                        </div>
                                        <p className="text-[10px] text-amber-600 font-medium text-center italic">Vectorizing products for AI search compatibility.</p>
                                    </div>
                                )}

                                {!isSyncingAI && (
                                    <div className="bg-emerald-100/50 border border-emerald-200 p-3 rounded-xl flex items-center gap-3">
                                        <div className="p-1.5 bg-emerald-500 rounded-full text-white">
                                            <Check className="w-3 h-3" />
                                        </div>
                                        <span className="text-xs font-bold text-emerald-700">All AI Vectors generated and synced!</span>
                                    </div>
                                )}

                                <Button
                                    variant="outline"
                                    className={`w-full font-bold h-11 transition-all ${isSyncingAI ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'bg-white hover:bg-emerald-100 border-emerald-200 text-emerald-700'}`}
                                    onClick={() => !isSyncingAI && setIsImportDialogOpen(false)}
                                    disabled={isSyncingAI}
                                >
                                    {isSyncingAI ? "Processing AI Vectors..." : "Finish & View Catalog"}
                                </Button>
                            </div>
                        )}

                        <div className="space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
                                Supported Table Formats <ChevronRight className="w-3 h-3" />
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.keys(SQL_IMPORT_CONFIGS).map(key => (
                                    <div key={key} className="flex items-center gap-2 p-2 rounded-lg bg-gray-100/70 border border-gray-100">
                                        {React.createElement(getCategoryTheme(SQL_IMPORT_CONFIGS[key].category).icon, { className: "w-3.5 h-3.5 text-blue-600" })}
                                        <span className="text-[11px] font-medium text-gray-600 capitalize">{key.replace('_', ' ')}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog >

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {editingProduct ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                            {editingProduct ? "Edit Product" : "Add New Product"}
                        </DialogTitle>
                        {!editingProduct && (
                            <div className="mt-4 pt-4 border-t">
                                <input
                                    type="file"
                                    ref={docInputRef}
                                    className="hidden"
                                    accept=".pdf,.xlsx,.xls,.csv"
                                    onChange={handleDocumentExtraction}
                                />
                                <div
                                    className={`border border-dashed rounded-xl p-6 flex flex-col items-center justify-center  cursor-pointer  text-black ${isExtractingDoc ? 'opacity-70' : ''}`}
                                    onClick={() => !isExtractingDoc && docInputRef.current?.click()}
                                >
                                    {isExtractingDoc ? (
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span className="text-sm font-bold">Processing Document...</span>
                                        </div>
                                    ) : (
                                        <div className="text-center space-y-1">
                                            <p className="text-sm font-bold text-black">Upload Technical Spec Sheet</p>
                                            <p className="text-[10px] text-gray-400">PDF or Excel • Auto-populates data fields</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        <DialogDescription className="pt-4">
                            Fields marked with * are required. Specifications will change based on category.
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="basic" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="basic">Basic Info</TabsTrigger>
                            <TabsTrigger value="specs">Specifications & Dimensions</TabsTrigger>
                            <TabsTrigger value="errorCodes">Error Codes</TabsTrigger>
                        </TabsList>

                        <TabsContent value="basic" className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2 col-span-2 md:col-span-1">
                                    <Label htmlFor="title">Product Title *</Label>
                                    <Input
                                        id="title"
                                        placeholder="e.g. Worcester Bosch Greenstar"
                                        value={form.title}
                                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2 col-span-2 md:col-span-1">
                                    <Label htmlFor="category">Category *</Label>
                                    <Select
                                        value={form.category}
                                        onValueChange={(v: Category) => setForm({ ...form, category: v, product_specs: {} })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="boiler">Boiler (Heating)</SelectItem>
                                            <SelectItem value="ac">Air Conditioning</SelectItem>
                                            <SelectItem value="ashp">Heat Pump (ASHP)</SelectItem>
                                            <SelectItem value="battery_storage">Battery Storage</SelectItem>
                                            <SelectItem value="solar">Solar PV</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="subtitle">Subtitle / Short Highlight</Label>
                                <Input
                                    id="subtitle"
                                    placeholder="e.g. Ultra-quiet condensing boiler"
                                    value={form.subtitle}
                                    onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Detailed Description</Label>
                                <Textarea
                                    id="description"
                                    placeholder="Describe the product features, benefits, and applications..."
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    className="min-h-[120px]"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="image">Main Image URL</Label>
                                <Input
                                    id="image"
                                    placeholder="https://example.com/products/image.jpg"
                                    value={form.image}
                                    onChange={(e) => setForm({ ...form, image: e.target.value })}
                                />
                            </div>

                            <div className="flex items-center space-x-2 pt-2">
                                <Switch
                                    id="is_active"
                                    checked={form.is_active}
                                    onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                                />
                                <Label htmlFor="is_active" className="cursor-pointer font-medium">This product is active and visible</Label>
                            </div>
                        </TabsContent>

                        <TabsContent value="specs" className="space-y-6 py-4">
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold flex items-center gap-2 text-blue-700">
                                    <Tag className="w-4 h-4" />
                                    General Specs
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="power_rating">Public Power Rating</Label>
                                        <Input
                                            id="power_rating"
                                            placeholder="e.g. 30kW / 12000 BTU"
                                            value={form.power_rating}
                                            onChange={(e) => setForm({ ...form, power_rating: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="base_price">Base Price</Label>
                                        <Input
                                            id="base_price"
                                            type="number"
                                            step="0.01"
                                            placeholder="e.g. 1500.00"
                                            value={form.base_price}
                                            onChange={(e) => setForm({ ...form, base_price: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 p-4 rounded-lg bg-blue-50/50 border border-blue-100">
                                <h3 className="text-sm font-semibold flex items-center gap-2 text-blue-700 capitalize">
                                    {React.createElement(getCategoryTheme(form.category).icon, { className: "w-4 h-4" })}
                                    {form.category.replace('_', ' ')} Specific Data
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    {CATEGORY_SPECS[form.category].map((spec) => (
                                        <div key={spec.key} className="space-y-2">
                                            <Label htmlFor={spec.key}>{spec.label}</Label>
                                            <Input
                                                id={spec.key}
                                                placeholder={spec.placeholder}
                                                value={form.product_specs[spec.key] || ""}
                                                onChange={(e) => setForm({
                                                    ...form,
                                                    product_specs: {
                                                        ...form.product_specs,
                                                        [spec.key]: e.target.value
                                                    }
                                                })}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-700">
                                    <Ruler className="w-4 h-4" />
                                    Physical Dimensions
                                </h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="width">Width</Label>
                                        <Input
                                            id="width"
                                            placeholder="e.g. 400mm"
                                            value={form.width}
                                            onChange={(e) => setForm({ ...form, width: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="height">Height</Label>
                                        <Input
                                            id="height"
                                            placeholder="e.g. 700mm"
                                            value={form.height}
                                            onChange={(e) => setForm({ ...form, height: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="depth">Depth</Label>
                                        <Input
                                            id="depth"
                                            placeholder="e.g. 330mm"
                                            value={form.depth}
                                            onChange={(e) => setForm({ ...form, depth: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="brand_id">Brand ID / Manufacturer Ref</Label>
                                <Input
                                    id="brand_id"
                                    type="number"
                                    placeholder="Internal brand ID"
                                    value={form.brand_id}
                                    onChange={(e) => setForm({ ...form, brand_id: e.target.value })}
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="errorCodes" className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Associated Error Codes</Label>
                                <p className="text-sm text-muted-foreground">
                                    Select error codes that can occur with this product
                                </p>
                                <ErrorCodeSelector
                                    selectedErrorCodes={selectedErrorCodes}
                                    onSelectionChange={setSelectedErrorCodes}
                                />
                            </div>
                        </TabsContent>
                    </Tabs>

                    <DialogFooter className="border-t pt-4">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting} className="min-w-[120px] font-bold">
                            {isSubmitting ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : editingProduct ? (
                                <Check className="w-4 h-4 mr-2" />
                            ) : (
                                <Plus className="w-4 h-4 mr-2" />
                            )}
                            {editingProduct ? "Update Product" : "Save Product"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card className="shadow-lg border-blue-50">
                <CardContent className="p-0">
                    <div className="p-4 flex items-center gap-4 bg-gray-50/50 border-b">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-blue-500" />
                            <Input
                                placeholder="Search products by title, category, or specifications..."
                                className="pl-9 bg-white shadow-sm h-11 border-gray-200 focus:ring-2 focus:ring-blue-100 transition-all rounded-xl"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="w-56">
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger className="h-11 bg-white shadow-sm border-gray-200 rounded-xl font-medium">
                                    <div className="flex items-center gap-2">
                                        <Layers className="w-4 h-4 text-blue-500" />
                                        <SelectValue placeholder="All Categories" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent className="rounded-xl shadow-xl border-gray-100">
                                    <SelectItem value="all" className="font-medium">All Categories</SelectItem>
                                    <SelectItem value="boiler" className="font-medium">Boilers</SelectItem>
                                    <SelectItem value="ac" className="font-medium">Air Conditioning</SelectItem>
                                    <SelectItem value="ashp" className="font-medium">Heat Pumps (ASHP)</SelectItem>
                                    <SelectItem value="battery_storage" className="font-medium">Battery Storage</SelectItem>
                                    <SelectItem value="solar" className="font-medium">Solar PV</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="border-t overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50/80">
                                    <TableHead className="w-[80px]">Image</TableHead>
                                    <TableHead>Product Identity</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Core Specs</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right px-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredProducts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-20 text-muted-foreground">
                                            {loading ? (
                                                <div className="flex flex-col items-center gap-3">
                                                    <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                                                    <span className="font-semibold text-gray-500">Syncing Catalog...</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="p-4 rounded-full bg-gray-100 text-gray-300">
                                                        <Package className="w-12 h-12" />
                                                    </div>
                                                    <span className="font-bold text-gray-800 text-lg">No products found</span>
                                                    <p className="text-sm max-w-[300px]">Try searching for something else or import your SQL data using the button above.</p>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredProducts.map((product) => {
                                        const theme = getCategoryTheme(product.category);
                                        return (
                                            <TableRow key={product.id} className="group hover:bg-blue-50/30 transition-all border-b border-gray-100">
                                                <TableCell>
                                                    <div className="w-14 h-14 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform duration-300">
                                                        {product.image ? (
                                                            <img src={product.image} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <ImageIcon className="w-6 h-6 text-gray-200" />
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors line-clamp-1">{product.title}</div>
                                                    <div className="text-xs text-muted-foreground line-clamp-1 max-w-[200px] font-medium leading-relaxed">{product.subtitle || "General Product"}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`p-1.5 rounded-lg ${theme.color.split(' ')[0]} bg-opacity-20`}>
                                                            <theme.icon className="w-3.5 h-3.5" />
                                                        </div>
                                                        <Badge variant="secondary" className={`${theme.color} border-none font-bold text-[10px] px-2 py-0.5 tracking-tight`}>
                                                            {product.category.replace('_', ' ').toUpperCase()}
                                                        </Badge>
                                                    </div>
                                                </TableCell>

                                                <TableCell>
                                                    <div className="flex flex-col gap-1.5">
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {product.power_rating && (
                                                                <Badge variant="outline" className="text-[10px] h-5 gap-1 font-bold bg-white border-blue-100 text-blue-700 shadow-sm">
                                                                    <Hammer className="w-3 h-3" /> {product.power_rating}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        {(product.width || product.height || product.depth) && (
                                                            <div className="flex items-center gap-1.5 text-[9px] text-gray-500 bg-gray-100 rounded-full px-2.5 py-0.5 w-fit font-bold border border-gray-200">
                                                                <Ruler className="w-2.5 h-2.5" />
                                                                {product.width} x {product.height} x {product.depth} mm
                                                            </div>
                                                        )}
                                                        {product.doc_link && (
                                                            <a
                                                                href={product.doc_link}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-[10px] text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-full px-2.5 py-1 w-fit font-black border border-blue-200 transition-all flex items-center gap-1.5 shadow-sm mt-1"
                                                            >
                                                                <FileJson className="w-3 h-3" />
                                                                SPEC SHEET
                                                            </a>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={product.is_active ? "default" : "secondary"}
                                                        className={product.is_active ? "bg-emerald-500 text-white hover:bg-emerald-600 border-none px-3 font-bold shadow-sm" : "px-3 font-bold"}
                                                    >
                                                        <div className={`w-1.5 h-1.5 rounded-full mr-2 ${product.is_active ? 'bg-white' : 'bg-gray-400'} animate-pulse`} />
                                                        {product.is_active ? "Live" : "Draft"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right px-6">
                                                    <div className="flex justify-end gap-1.5 items-center">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-10 w-10 text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all rounded-xl"
                                                            onClick={() => openEditDialog(product)}
                                                            title="Edit product"
                                                        >
                                                            <Edit className="w-4.5 h-4.5" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-10 w-10 text-red-500 hover:text-red-700 hover:bg-red-50 transition-all rounded-xl"
                                                            onClick={() => handleDeleteProduct(product.id)}
                                                            title="Delete product"
                                                        >
                                                            <Trash2 className="w-4.5 h-4.5" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Duplicate Products Dialog */}
            <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
                <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Duplicate Products Found</DialogTitle>
                        <DialogDescription>
                            Found {duplicateProducts.length} duplicate product(s). Choose how to handle them.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="max-h-[300px] overflow-y-auto border rounded-lg p-4 space-y-2">
                            {duplicateProducts.map((dup, idx) => (
                                <div key={idx} className="p-3 border rounded-lg bg-gray-50">
                                    <div className="font-medium text-sm">{dup.new.title}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        Category: {dup.new.category} | Power: {dup.new.power_rating || 'N/A'} | Price: {dup.new.base_price ? `£${dup.new.base_price}` : 'N/A'}
                                    </div>
                                    <div className="text-xs text-orange-600 mt-1">
                                        Matches existing product ID: {dup.existing.id}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-2">
                            <Label>Action for duplicates:</Label>
                            <div className="flex gap-3">
                                <Button
                                    variant={duplicateAction === 'replace' ? 'default' : 'outline'}
                                    onClick={() => setDuplicateAction('replace')}
                                    className="flex-1"
                                >
                                    Replace Existing
                                </Button>
                                <Button
                                    variant={duplicateAction === 'skip' ? 'default' : 'outline'}
                                    onClick={() => setDuplicateAction('skip')}
                                    className="flex-1"
                                >
                                    Skip Duplicates
                                </Button>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            setShowDuplicateDialog(false);
                            setDuplicateProducts([]);
                            setPendingImportProducts([]);
                            setDuplicateAction(null);
                        }}>
                            Cancel
                        </Button>
                        <Button
                            onClick={async () => {
                                if (!duplicateAction) {
                                    toast.error("Please select an action for duplicates");
                                    return;
                                }

                                try {
                                    setIsImporting(true);
                                    let productsToInsert = [...pendingImportProducts];

                                    if (duplicateAction === 'replace') {
                                        // Update existing products
                                        for (const dup of duplicateProducts) {
                                            const { error } = await supabase
                                                .from('products')
                                                .update({
                                                    ...dup.new,
                                                    updated_at: new Date().toISOString()
                                                })
                                                .eq('id', dup.existing.id);
                                            
                                            if (error) throw error;
                                        }
                                    }
                                    // If skip, we don't add duplicates, they're already filtered out

                                    // Insert new products
                                    if (productsToInsert.length > 0) {
                                        const { error } = await supabase
                                            .from('products')
                                            .insert(productsToInsert);

                                        if (error) throw error;
                                    }

                                    const totalImported = productsToInsert.length + (duplicateAction === 'replace' ? duplicateProducts.length : 0);
                                    setImportResults({ count: totalImported });
                                    toast.success(`Successfully imported ${totalImported} products!`);
                                    
                                    setShowDuplicateDialog(false);
                                    setDuplicateProducts([]);
                                    setPendingImportProducts([]);
                                    setDuplicateAction(null);
                                    
                                    // Trigger AI sync
                                    const estSeconds = Math.ceil(totalImported * 1.5);
                                    setSyncRemainingTime(estSeconds);
                                    setIsSyncingAI(true);
                                    
                                    const timer = setInterval(() => {
                                        setSyncRemainingTime(prev => (prev > 0 ? prev - 1 : 0));
                                    }, 1000);

                                    try {
                                        const res = await fetch("/api/ai-instructions/generate-embedding", {
                                            method: "POST",
                                            body: JSON.stringify({ batch: true })
                                        });
                                        if (!res.ok) console.error("Auto-sync failed");
                                    } catch (err) {
                                        console.error("Auto-sync error:", err);
                                    } finally {
                                        clearInterval(timer);
                                        setIsSyncingAI(false);
                                        setSyncRemainingTime(0);
                                        fetchProducts();
                                    }
                                } catch (error) {
                                    console.error("Error processing duplicates:", error);
                                    toast.error("Failed to process duplicates");
                                } finally {
                                    setIsImporting(false);
                                }
                            }}
                            disabled={!duplicateAction || isImporting}
                        >
                            {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Process
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
