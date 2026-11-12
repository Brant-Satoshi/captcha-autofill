interface Props {
	value: string[];
	onChange: (next: string[]) => void;
	placeholder: string;
}

/** 可增删的 CSS 选择器列表 */
export function SelectorList({ value, onChange, placeholder }: Props) {
	return (
		<div className="custom-selectors">
			{value.map((selector, index) => (
				<div key={index} className="selector-item">
					<input
						type="text"
						value={selector}
						placeholder={placeholder}
						onChange={(event) => onChange(value.map((item, i) => (i === index ? event.target.value : item)))}
					/>
					<button
						type="button"
						className="remove-selector"
						title="删除"
						onClick={() => onChange(value.filter((_, i) => i !== index))}
					>
						×
					</button>
				</div>
			))}
			<button type="button" className="add-selector" onClick={() => onChange([...value, ''])}>
				添加选择器
			</button>
		</div>
	);
}
