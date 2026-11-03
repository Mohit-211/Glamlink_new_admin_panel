/** @format */

import React, { useEffect, useState } from "react";
import {
    Table,
	Space,
	message,
	Modal,
	Form,
	Input,
	Button,
	type TableColumnsType,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import {
	GetAllAuthors,
	UpdateAuthors,
	DeleteAuthors,
	AddAuthors,
} from "../../../services/Api/JournalApi";
import { type WithIndex } from "../../../utils/table";
import type { Author } from "../../../types/journal";
import JournalImageField, { type PickedImage } from "../JournalImageField";

const { Search } = Input;

const Authors = () => {
	const [data, setData] = useState<WithIndex<Author>[]>([]);
	const [backupData, setBackupData] = useState<WithIndex<Author>[]>([]);
	const [loading, setLoading] = useState(false);

	const [modalVisible, setModalVisible] = useState(false);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [photo, setPhoto] = useState<PickedImage | null>(null);

	const [form] = Form.useForm();

	// ================= TABLE =================

	const columns: TableColumnsType<WithIndex<Author>> = [
		{
			title: "S.No.",
			dataIndex: "index",
			width: "5%",
		},
		{
			title: "Profile",
			dataIndex: "profile_image",
			render: (img) =>
				img ? (
					<img
						src={img}
						alt="profile"
						style={{
							width: 40,
							height: 40,
							borderRadius: "50%",
							objectFit: "cover",
						}}
					/>
				) : (
					"-"
				),
			width: "10%",
		},
		{
			title: "Name",
			dataIndex: "name",
			width: "20%",
		},
		{
			title: "Designation",
			dataIndex: "designation",
			width: "20%",
		},
		{
			title: "Bio",
			dataIndex: "bio",
			render: (bio) => (bio?.length > 80 ? bio.substring(0, 80) + "..." : bio),
			width: "30%",
		},
		{
			title: "Action",
			render: (_, record) => (
				<Space>
					<Button type="link" onClick={() => openEditModal(record)}>
						Edit
					</Button>
					<Button type="link" danger onClick={() => handleDelete([record.id])}>
						Delete
					</Button>
				</Space>
			),
		},
	];

	// ================= FETCH =================

	const getData = async () => {
		try {
			setLoading(true);
			const result = await GetAllAuthors();

			const newData = result.data.rows.map((item, index) => ({
				...item,
				index: index + 1,
			}));

			setData(newData);
			setBackupData(newData);
		} catch {
			message.error("Failed to load Authors");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		getData();
	}, []);

	// ================= SEARCH =================

	const onSearch = (value: string) => {
		const filtered = backupData.filter(
			(item) =>
				item.name.toLowerCase().includes(value.toLowerCase()) ||
				item.designation?.toLowerCase().includes(value.toLowerCase()),
		);
		setData(filtered);
	};

	// ================= DELETE =================

	const handleDelete = (ids: React.Key[]) => {
		Modal.confirm({
			title: "Delete Author",
			content: "Are you sure you want to delete this author?",
			onOk: async () => {
				try {
					await DeleteAuthors(ids);
					message.success("Author deleted successfully");
					getData();
				} catch {
					message.error("Failed to delete Author");
				}
			},
		});
	};
	// ================= ADD =================

	const openAddModal = () => {
		setEditingId(null);
		form.resetFields();
		setPhoto(null);
		setModalVisible(true);
	};

	// ================= EDIT =================

	const openEditModal = (record: Author) => {
		setEditingId(record.id);

		form.setFieldsValue({
			name: record.name,
			designation: record.designation,
			bio: record.bio,
		});

		setPhoto(record.profile_image ? { source: record.profile_image } : null);

		setModalVisible(true);
	};

	// ================= SUBMIT =================

	const handleSubmit = async () => {
		try {
			const values = await form.validateFields();

			const formData = new FormData();
			formData.append("name", values.name);
			formData.append("designation", values.designation);
			formData.append("bio", values.bio);

			// If a new photo was picked (cropped) or the saved one cropped again
			if (photo?.file) {
				formData.append("images", photo.file);
			}

			// If editing and no new file selected → DO NOT send profile_image
			// Backend should keep old image

			if (editingId) {
				await UpdateAuthors(editingId, formData);
				message.success("Author updated successfully");
			} else {
				await AddAuthors(formData);
				message.success("Author added successfully");
			}

			setModalVisible(false);
			form.resetFields();
			setPhoto(null);
			getData();
		} catch (err) {
			message.error("Something went wrong.");
		}
	};

	return (
		<div>
			{/* HEADER */}
			<div
				style={{
				    display: "flex",
				    justifyContent: "space-between",
				    alignItems: "center",
				    marginBottom: "20px"
				}}>
				<div>
					<h3>AUTHORS</h3>
					<p>View, add, edit, and delete Authors</p>
				</div>

				<Space>
					<Search
						placeholder="Search Author..."
						allowClear
						onChange={(e) => onSearch(e.target.value)}
						style={{ width: 250 }}
					/>
					<Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
						Add Author
					</Button>
				</Space>
			</div>

			<Table
				columns={columns}
				rowKey="id"
				dataSource={data}
				loading={loading}
			/>

			{/* MODAL */}

			<Modal
				title={editingId ? "Edit Author" : "Add Author"}
				open={modalVisible}
				onOk={handleSubmit}
				onCancel={() => setModalVisible(false)}
				okText={editingId ? "Update" : "Add"}
			>
				<Form form={form} layout="vertical">
					<Form.Item label="Name" name="name" rules={[{ required: true }]}>
						<Input />
					</Form.Item>

					<Form.Item
						label="Designation"
						name="designation"
						rules={[{ required: true }]}
					>
						<Input />
					</Form.Item>

					<Form.Item label="Bio" name="bio" rules={[{ required: true }]}>
						<Input.TextArea rows={4} />
					</Form.Item>

					<Form.Item label="Profile Image">
						<JournalImageField kind="author" value={photo} onChange={setPhoto} />
					</Form.Item>
				</Form>
			</Modal>
		</div>
	);
};

export default Authors;
