// @ts-ignore - TypeORM is expected to be installed in the project dependencies.
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm"
import { User } from "./app-user.entity"   
import { BaseCustomEntity } from "../../cross-cutting/entities/base-custom.entity";
import { IUserSessionEntity } from "../interface/user-session.interface";

@Entity("user_session")
export class UserSession extends BaseCustomEntity implements IUserSessionEntity{

    @Column({name: "user_id", type: "varchar", length: 26 })
    userId!: string;
    @ManyToOne(()=> User, {onDelete: "CASCADE"})
    @JoinColumn({name: "user_id", referencedColumnName: "id" })
    user!: User 

    @Column({name: "refresh_token_hash", type:"varchar", length: 255, unique: true })
    refreshTokenHash!: string

    @Column({name: "ip_address", type:"inet"})
    ipAddress!: string

    @Column({name: "user_agent", type: "text"})
    userAgent!: string

    @Column({name: "expires_at", type:"timestamptz"})
    expiresAt!: Date

    @Column({name: "revoked_at",type: "timestamptz"})
    revokedAt!: Date
}
